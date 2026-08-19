"""Google Gemini — generation.

Embeddings are Gemini too, but they are not this module's job: they live in
``gemini_embeddings.py`` and are selected by ``EMBEDDING_PROVIDER``. The split
is worth stating because it is the kind of thing a later reader "tidies up"
into one client. A collection's vector width is fixed when it is created, so
changing the embedding model is a re-index of the whole corpus rather than a
configuration edit; generation carries no such constraint, and keeping the two
apart is what stops a change to one being made casually on behalf of the other.

Four things this module has to get right:

**Message translation.** The rest of the service speaks the OpenAI shape.
Gemini wants the system message hoisted into ``systemInstruction`` and the
assistant role renamed to ``model``. Doing that here — rather than making the
prompt builder aware of vendors — is what keeps ``ChatProvider`` a real
abstraction.

**Safety thresholds.** A litigation firm's assistant answers questions about
criminal defence, bail, fraud and property disputes. On default thresholds
Gemini's dangerous-content and harassment filters block a noticeable share of
legitimate questions about a criminal practice, which reads to a visitor as the
assistant refusing to discuss the firm's own published work. Thresholds are set
to block only high-confidence harm, and a block that still happens is surfaced
as a ``GenerationError`` so the chat service falls back to quoting the firm's
own text rather than showing an error.

**The key never enters a URL.** Gemini accepts ``?key=``; this client sends the
``x-goog-api-key`` header instead. Query strings end up in proxy logs, browser
histories and error reports in a way headers do not.

**Reasoning tokens share the answer's budget.** Gemini 3.x reasons before it
replies and charges those tokens against ``maxOutputTokens``, so a ceiling set
for the answer is really a ceiling for both. Left alone it starves the reply —
measured at 479 of 500 tokens spent reasoning, with every answer reaching the
visitor cut off mid-sentence. See ``to_gemini_payload`` and
``GEMINI_THINKING_HEADROOM_TOKENS``.
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from app.core.config import Settings
from app.core.exceptions import GenerationError
from app.core.logging import get_logger
from app.clients.http import post_json

log = get_logger(__name__)

# Gemini's own names for the roles this service uses. "system" is absent
# deliberately — it is hoisted out of the turn list entirely.
_ROLE_MAP = {"user": "user", "assistant": "model"}

# BLOCK_ONLY_HIGH rather than the default BLOCK_MEDIUM_AND_ABOVE. See the module
# docstring: the lower setting suppresses answers about the firm's criminal and
# recovery practice, which are exactly the areas it publishes pages about.
_SAFETY_SETTINGS = [
    {"category": category, "threshold": "BLOCK_ONLY_HIGH"}
    for category in (
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
    )
]

# finishReason values that mean "there is no usable answer here". MAX_TOKENS is
# deliberately absent: a completion cut off at the token ceiling is truncated,
# not invalid, and the grounded text it did produce is still worth showing.
_BAD_FINISH = {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}


def to_gemini_payload(messages: list[dict[str, str]], settings: Settings) -> dict[str, Any]:
    """Translate OpenAI-shaped messages into a Gemini request body.

    Consecutive same-role turns are merged, because Gemini rejects a
    ``contents`` array that does not alternate — a constraint the OpenAI format
    does not have, and one that history replay could otherwise violate.
    """
    system_parts: list[str] = []
    turns: list[dict[str, Any]] = []

    for message in messages:
        role = message.get("role", "")
        content = (message.get("content") or "").strip()
        if not content:
            continue

        if role == "system":
            system_parts.append(content)
            continue

        mapped = _ROLE_MAP.get(role)
        if mapped is None:
            continue

        if turns and turns[-1]["role"] == mapped:
            turns[-1]["parts"][0]["text"] += f"\n\n{content}"
        else:
            turns.append({"role": mapped, "parts": [{"text": content}]})

    generation_config: dict[str, Any] = {
        # Gemini counts reasoning tokens against this same ceiling, so the
        # headroom is added on top of the answer budget rather than taken out of
        # it. Without it a 500-token ceiling was being spent almost entirely on
        # reasoning — measured at 479 of 500 — and every reply reached the
        # visitor cut off mid-sentence.
        "maxOutputTokens": settings.llm_max_output_tokens + settings.gemini_thinking_headroom_tokens,
        # Low but not zero, matching the Hugging Face path. This assistant
        # restates sourced material in a professional register; it is not
        # being asked to be creative.
        "temperature": 0.2,
    }

    # Omitted entirely when blank, so a model that does not accept the field —
    # or a future one that names it differently — can be used by clearing the
    # setting rather than by editing this module.
    thinking_level = settings.gemini_thinking_level.strip().lower()
    if thinking_level:
        generation_config["thinkingConfig"] = {"thinkingLevel": thinking_level}

    payload: dict[str, Any] = {
        "contents": turns,
        "generationConfig": generation_config,
        "safetySettings": _SAFETY_SETTINGS,
    }
    if system_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
    return payload


def _check_refusal(data: Any) -> tuple[dict[str, Any], str | None]:
    """Raise if Gemini refused, otherwise return ``(candidate, finishReason)``.

    Gemini signals refusal in two different places depending on whether the
    *prompt* or the *completion* tripped a filter, and neither is an HTTP error.
    Both have to be checked or a block arrives downstream as a confusing empty
    string that looks like the model simply had nothing to say.
    """
    if not isinstance(data, dict):
        raise GenerationError("unexpected response shape")

    feedback = data.get("promptFeedback") or {}
    if feedback.get("blockReason"):
        raise GenerationError(f"prompt blocked: {feedback['blockReason']}")

    candidates = data.get("candidates") or []
    if not candidates:
        raise GenerationError("response contained no candidates")

    candidate = candidates[0]
    finish = candidate.get("finishReason")
    if finish in _BAD_FINISH:
        raise GenerationError(f"completion blocked: {finish}")
    return candidate, finish


def _text_of(candidate: dict[str, Any]) -> str:
    parts = (candidate.get("content") or {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts if isinstance(part, dict))


def _trim_to_last_sentence(text: str) -> str:
    """Cut a truncated completion back to its last finished sentence.

    A reply that stops mid-clause — "These include Civil Litigation" — reads to
    a visitor as a broken assistant, and on a law firm's site an answer that
    breaks off in the middle of a list of practice areas is actively
    misleading about what the firm does.

    The fragment is dropped whenever there is a finished sentence to fall back
    to, even when that costs most of the text. A half-listed set of practice
    areas is worse than a shorter complete one, because the visitor cannot tell
    it was cut. Only when the reply contains no sentence end at all is it
    returned as-is — at that point the fragment is the entire answer, and
    showing nothing would be the greater failure.

    This is a net, not a routine path: GEMINI_THINKING_HEADROOM_TOKENS is sized
    so that answers finish well inside the ceiling.
    """
    stop = max(text.rfind("."), text.rfind("?"), text.rfind("!"))
    if stop == -1:
        return text
    return text[: stop + 1].strip()


def extract_text(data: Any) -> str:
    """The completion from a whole (non-streaming) response.

    An empty result here is genuinely a failure: a complete response with no
    text means the model produced nothing usable.
    """
    candidate, finish = _check_refusal(data)
    text = _text_of(candidate).strip()
    if not text:
        raise GenerationError(f"empty completion (finishReason={finish})")
    # MAX_TOKENS is truncation rather than refusal, so the grounded text still
    # stands — but it is shown as a finished thought rather than as a fragment.
    # The headroom above is what should keep this rare; this is the net under it.
    if finish == "MAX_TOKENS":
        log.warning(
            "completion hit the output ceiling and was trimmed to its last full sentence",
            extra={"event": "generation_truncated"},
        )
        return _trim_to_last_sentence(text)
    return text


def extract_stream_text(data: Any) -> str:
    """The text carried by one SSE frame — possibly none.

    Unlike the whole-response case, an empty frame is normal rather than
    broken: the final frame usually carries only ``finishReason`` and
    ``usageMetadata``. Refusals are still checked, so a stream that is cut off
    by a safety filter raises instead of ending quietly and passing for a
    complete, if terse, answer.
    """
    candidate, _ = _check_refusal(data)
    return _text_of(candidate)


class GeminiClient:
    """One Gemini model, behind the ``ChatProvider`` contract."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient, model: str) -> None:
        self._settings = settings
        self._client = client
        self._model = model

    @property
    def name(self) -> str:
        return f"gemini:{self._model}"

    @property
    def configured(self) -> bool:
        return bool(self._settings.gemini_api_key.strip())

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "x-goog-api-key": self._settings.gemini_api_key,
            "Content-Type": "application/json",
        }

    def _url(self, method: str, *, sse: bool = False) -> str:
        base = self._settings.gemini_api_base.rstrip("/")
        url = f"{base}/models/{self._model}:{method}"
        return f"{url}?alt=sse" if sse else url

    async def generate(self, messages: list[dict[str, str]]) -> str:
        if not self.configured:
            raise GenerationError("GEMINI_API_KEY is not configured")

        data = await post_json(
            self._client,
            self._url("generateContent"),
            to_gemini_payload(messages, self._settings),
            headers=self._headers,
            timeout=self._settings.llm_timeout_seconds,
            failure=GenerationError,
            provider=self.name,
        )
        return extract_text(data)

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Yield text fragments as Gemini produces them.

        Not retried. A retry would have to replay the tokens already sent to the
        visitor, and a half-written answer restarting mid-sentence is worse than
        the failure it is papering over — the caller falls back instead.
        """
        if not self.configured:
            raise GenerationError("GEMINI_API_KEY is not configured")

        payload = to_gemini_payload(messages, self._settings)
        try:
            async with self._client.stream(
                "POST",
                self._url("streamGenerateContent", sse=True),
                json=payload,
                headers=self._headers,
                timeout=self._settings.llm_timeout_seconds,
            ) as response:
                if response.status_code >= 400:
                    body = (await response.aread())[:200].decode("utf-8", "replace")
                    raise GenerationError(f"HTTP {response.status_code}: {body}")

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    blob = line[5:].strip()
                    if not blob or blob == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(blob)
                    except ValueError:
                        # A partial frame is not fatal — the stream continues
                        # and the next frame is usually well-formed.
                        continue

                    # Same refusal checks as the non-streaming path, so a
                    # filtered stream raises rather than quietly ending early
                    # and passing for a complete, if terse, answer. Empty
                    # frames are skipped rather than yielded — the last frame
                    # normally carries only finishReason and usage.
                    fragment = extract_stream_text(chunk)
                    if fragment:
                        yield fragment
        except httpx.TimeoutException:
            raise GenerationError(f"stream timeout after {self._settings.llm_timeout_seconds}s") from None
        except httpx.HTTPError as exc:
            raise GenerationError(f"stream transport error: {type(exc).__name__}") from exc
