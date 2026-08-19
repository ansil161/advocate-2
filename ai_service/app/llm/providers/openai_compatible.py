"""Any vendor speaking the OpenAI chat-completions dialect.

Groq is the one wired up today, but nothing in here is Groq-specific — the
dialect is the interface, so pointing ``base_url`` at OpenAI, Together,
Fireworks or a self-hosted vLLM gives another provider for the cost of two
config lines and no new code. That is the practical payoff of ``ChatProvider``:
the failover chain grows without the RAG layer learning anything.

It also means no message translation. The prompt builder already emits
``{"role", "content"}`` in this exact shape, so unlike the Gemini client there
is nothing to rearrange on the way out — which is one fewer place for a system
prompt to be silently dropped or a history turn to be reordered.
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


def _body(messages: list[dict[str, str]], model: str, settings: Settings, *, stream: bool) -> dict[str, Any]:
    return {
        "model": model,
        "messages": messages,
        "max_tokens": settings.llm_max_output_tokens,
        # Matches the Gemini path deliberately. A visitor should not be able to
        # tell which vendor answered from how florid the prose is.
        "temperature": 0.2,
        "stream": stream,
    }


def extract_text(data: Any) -> str:
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise GenerationError("unexpected chat completion shape") from None

    text = (content or "").strip()
    if not text:
        raise GenerationError("model returned an empty completion")
    return text


class OpenAICompatibleClient:
    """One model at one OpenAI-compatible endpoint."""

    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient,
        *,
        vendor: str,
        base_url: str,
        api_key: str,
        model: str,
    ) -> None:
        self._settings = settings
        self._client = client
        self._vendor = vendor
        self._base = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model

    @property
    def name(self) -> str:
        return f"{self._vendor}:{self._model}"

    @property
    def configured(self) -> bool:
        return bool(self._api_key.strip())

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    async def generate(self, messages: list[dict[str, str]]) -> str:
        if not self.configured:
            raise GenerationError(f"{self._vendor} API key is not configured")

        data = await post_json(
            self._client,
            f"{self._base}/chat/completions",
            _body(messages, self._model, self._settings, stream=False),
            headers=self._headers,
            timeout=self._settings.llm_timeout_seconds,
            failure=GenerationError,
            provider=self.name,
        )
        return extract_text(data)

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Yield deltas as they arrive.

        Not retried, for the same reason as the Gemini client: a retry would
        have to replay tokens the visitor has already read, and an answer that
        restarts mid-sentence is worse than the failure it hides.
        """
        if not self.configured:
            raise GenerationError(f"{self._vendor} API key is not configured")

        try:
            async with self._client.stream(
                "POST",
                f"{self._base}/chat/completions",
                json=_body(messages, self._model, self._settings, stream=True),
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
                    # "[DONE]" is the dialect's end-of-stream marker, not JSON.
                    if not blob or blob == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(blob)
                    except ValueError:
                        continue

                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    fragment = (choices[0].get("delta") or {}).get("content") or ""
                    if fragment:
                        yield fragment
        except httpx.TimeoutException:
            raise GenerationError(f"stream timeout after {self._settings.llm_timeout_seconds}s") from None
        except httpx.HTTPError as exc:
            raise GenerationError(f"stream transport error: {type(exc).__name__}") from exc
