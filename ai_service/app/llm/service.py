"""Generation: try each provider in turn, and check what comes back.

Three responsibilities beyond calling an API.

**Failing over across vendors, not just models.** The list is ordered and
heterogeneous — Gemini first, Hugging Face behind it — so an outage at one
vendor costs a slightly different answer rather than no answer. Each entry is a
``ChatProvider``; this module never learns which vendor it is talking to.

**Not re-trying a provider that is down.** Every provider has a circuit
breaker. Without one, a dead vendor is still attempted on every request, and
each attempt burns its full retry budget before failover even begins — so the
visitor waits out the broken provider before the working one is called. An open
breaker is skipped instantly.

**Checking the completion before it is shown.** A model that has been talked
into reciting its instructions produces a perfectly well-formed response; the
transport layer has no reason to reject it. So the output is inspected for the
markers that only appear in the system prompt and in the context fences, and a
completion carrying them is discarded rather than repaired — a leaked prompt
that has been partially scrubbed is still a leaked prompt.
"""

from __future__ import annotations

import re
import time
from typing import AsyncIterator, Sequence

from app.llm.base import ChatProvider
from app.llm.circuit_breaker import CircuitBreaker
from app.core.config import Settings
from app.core.exceptions import GenerationError
from app.core.logging import get_logger

log = get_logger(__name__)

# Distinctive strings that exist only in the system prompt or in the fences
# around the context. None of them can occur in an honest answer about a law
# firm, which is what makes them usable as a leak signal.
_LEAK_MARKERS = (
    "<<<",
    ">>>",
    "reference material:",
    "grounding —",
    "what you are not",
    "you are the sla advocates assistant",
    "visitor question",
    "system prompt",
    "my instructions are",
    "my system message",
)

# A leading parenthetical or bracketed aside describing the reply rather than
# being the reply — "(with phone number immediately due to urgency):*",
# "[Responding warmly]". Models produce these when a prompt reads as a
# procedure, and to a visitor in distress it looks like being talked about
# rather than to. Anchored to the start and bounded in length so that a genuine
# answer opening with a parenthetical aside is left alone.
_STAGE_DIRECTION_RE = re.compile(r"^\s*[\(\[\*]{1,2}[^)\]\n]{0,120}[\)\]]\s*[:\-–—]?\s*\*{0,2}\s*")

# The models sometimes open with the throat-clearing the style rules ask them
# to avoid. Cheaper to remove here than to keep re-prompting for it.
_PREAMBLE_RE = re.compile(
    r"^(?:based on|according to|as per|from)\s+the\s+(?:reference|provided|available|given)\s+"
    r"(?:material|information|context|passages)[,:]?\s*",
    re.IGNORECASE,
)


def looks_leaked(answer: str) -> bool:
    lowered = answer.lower()
    return any(marker in lowered for marker in _LEAK_MARKERS)


def tidy(answer: str) -> str:
    """Light cosmetic cleanup. Never changes meaning."""
    cleaned = _STAGE_DIRECTION_RE.sub("", answer.strip())
    cleaned = _PREAMBLE_RE.sub("", cleaned)
    # Some providers wrap the whole completion in quotes when the prompt ends
    # with a quoted block.
    if len(cleaned) > 1 and cleaned[0] == '"' and cleaned[-1] == '"':
        cleaned = cleaned[1:-1].strip()
    return cleaned[:1].upper() + cleaned[1:] if cleaned else cleaned


class LLMService:
    def __init__(self, settings: Settings, providers: Sequence[ChatProvider]) -> None:
        self._settings = settings
        self._providers = list(providers)
        self._breakers = {
            provider.name: CircuitBreaker(
                provider.name,
                failure_threshold=settings.circuit_failure_threshold,
                cooldown_seconds=settings.circuit_cooldown_seconds,
            )
            for provider in self._providers
        }

    def _available(self) -> list[ChatProvider]:
        """Providers worth attempting: credentialed, and not currently tripped."""
        ready: list[ChatProvider] = []
        for provider in self._providers:
            if not provider.configured:
                continue
            if not self._breakers[provider.name].allows():
                log.info(
                    "skipping provider with open circuit",
                    extra={"event": "llm_skipped", "provider": provider.name},
                )
                continue
            ready.append(provider)
        return ready

    async def generate(self, messages: list[dict[str, str]]) -> tuple[str, str]:
        """Return ``(answer, provider_name)``, trying each provider in turn.

        Raises ``GenerationError`` only once every provider has failed — the
        chat service treats that as the signal to answer from retrieved text
        directly rather than to fail the request.
        """
        candidates = self._available()
        if not candidates:
            raise GenerationError("no generation provider is available")

        last_detail = ""
        for provider in candidates:
            breaker = self._breakers[provider.name]
            started = time.perf_counter()
            try:
                raw = await provider.generate(messages)
            except GenerationError as exc:
                last_detail = exc.detail
                breaker.record_failure()
                log.warning(
                    "provider failed",
                    extra={"event": "llm_failed", "provider": provider.name, "reason": exc.detail},
                )
                continue

            duration = round((time.perf_counter() - started) * 1000)

            if looks_leaked(raw):
                # The upstream is healthy — it answered — so this is not a
                # breaker failure. Falling through to the next provider gives a
                # genuinely different chance of a clean answer; retrying this
                # one would resend the identical request.
                breaker.record_success()
                last_detail = "completion contained prompt markers"
                log.warning(
                    "discarded completion carrying prompt markers",
                    extra={
                        "event": "llm_leak_blocked",
                        "provider": provider.name,
                        "duration_ms": duration,
                    },
                )
                continue

            answer = tidy(raw)
            if not answer:
                breaker.record_success()
                last_detail = "completion was empty after cleanup"
                continue

            breaker.record_success()
            log.info(
                "generation complete",
                extra={"event": "llm", "provider": provider.name, "duration_ms": duration},
            )
            return answer, provider.name

        raise GenerationError(last_detail or "all generation providers failed")

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[tuple[str, str]]:
        """Yield ``(fragment, provider_name)`` from the first provider that works.

        Failover happens only *before* the first fragment is emitted. Once text
        has reached the visitor, switching providers would mean either replaying
        it or continuing someone else's half-finished sentence; the caller is
        told the stream failed instead, and falls back to a non-streamed answer.

        The leak check runs on the accumulated text rather than per fragment,
        because a marker can straddle a chunk boundary. Fragments are held back
        until the buffer is long enough to be judged.
        """
        candidates = self._available()
        if not candidates:
            raise GenerationError("no generation provider is available")

        last_detail = ""
        for provider in candidates:
            breaker = self._breakers[provider.name]
            emitted = False
            buffer = ""
            try:
                async for fragment in provider.stream(messages):
                    buffer += fragment
                    if looks_leaked(buffer):
                        raise GenerationError("stream contained prompt markers")
                    emitted = True
                    yield fragment, provider.name
            except GenerationError as exc:
                last_detail = exc.detail
                breaker.record_failure()
                log.warning(
                    "provider stream failed",
                    extra={
                        "event": "llm_stream_failed",
                        "provider": provider.name,
                        "reason": exc.detail,
                        "status": "mid_stream" if emitted else "pre_stream",
                    },
                )
                if emitted:
                    # Cannot fail over cleanly — the visitor already has text.
                    raise
                continue

            breaker.record_success()
            return

        raise GenerationError(last_detail or "all generation providers failed")

    def health(self) -> list[dict[str, object]]:
        """Breaker state per provider. Safe for /health — no credentials, no content."""
        return [
            {**self._breakers[p.name].snapshot(), "configured": p.configured}
            for p in self._providers
        ]
