"""LangChain-backed generation, using its own ``with_fallbacks`` chain.

Opt-in. Add ``langchain`` to ``LLM_PROVIDER_ORDER`` to enable it; leave it out
and nothing in this module is imported, which is the point of the deferred
imports below. On this machine ``langchain_groq`` alone costs 22 seconds to
import and the full stack exceeded two minutes cold — paid once at startup, but
paid by every deploy, every health check and every autoscale event, so it is not
something to levy on a deployment that has not asked for it.

What it adds over the native chain in ``services/llm.py`` is LangChain's own
retry/fallback machinery and its ecosystem — callbacks, LangSmith tracing,
output parsers — for teams already invested in it. What it does not add is
resilience: the native chain already fails over across vendors and, unlike
``with_fallbacks``, remembers that a provider is down instead of re-probing it
on every request. So this is presented as one more ``ChatProvider`` rather than
as a replacement, and the circuit breaker in ``LLMService`` still wraps it.

The whole LangChain chain therefore appears to the rest of the service as a
single provider. That is deliberate: its internal Gemini→Groq fallback is its
business, and the RAG layer stays unable to tell one vendor from another.

**Reasoning-token warning — read before enabling this with a Gemini 3.x model.**
Gemini charges reasoning tokens against the same ceiling as the reply. The
native client in ``gemini.py`` handles this two ways: it adds
``GEMINI_THINKING_HEADROOM_TOKENS`` to the ceiling, *and* it sends
``thinkingConfig.thinkingLevel`` to hold reasoning down. Only the first of those
is portable to LangChain — ``ChatGoogleGenerativeAI`` has no
vendor-agnostic way to pass ``thinkingLevel``, and the parameter it does accept
varies by ``langchain-google-genai`` version, which cannot be verified here
because LangChain is not installed in this environment.

So the headroom is applied below (a plain integer on a documented parameter,
and enough on its own to prevent the truncation that was reaching visitors),
and enabling this provider logs a warning naming the gap. Without reasoning
held down, a complex prompt can still spend more of the budget thinking than
the native path would. Verify against ``usageMetadata.thoughtsTokenCount``
before putting this leg in front of visitors.
"""

from __future__ import annotations

from typing import Any, AsyncIterator

from app.core.config import Settings
from app.core.exceptions import GenerationError
from app.core.logging import get_logger

log = get_logger(__name__)


def _message_classes() -> tuple[Any, Any, Any]:
    """Import LangChain's message types on first use.

    Deferred rather than module-level so that importing this file — which
    ``clients/factory.py`` does unconditionally — stays free.
    """
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    return SystemMessage, HumanMessage, AIMessage


def to_langchain_messages(messages: list[dict[str, str]]) -> list[Any]:
    """Translate OpenAI-shaped turns into LangChain message objects."""
    System, Human, Ai = _message_classes()
    mapping = {"system": System, "user": Human, "assistant": Ai}

    converted: list[Any] = []
    for message in messages:
        cls = mapping.get(message.get("role", ""))
        content = (message.get("content") or "").strip()
        if cls is None or not content:
            continue
        converted.append(cls(content=content))
    return converted


def _content_of(chunk: Any) -> str:
    """Flatten a LangChain message's content to text.

    Newer versions may return a list of content blocks rather than a string,
    so both shapes are handled — a silent "" here would look like a model that
    simply had nothing to say.
    """
    content = getattr(chunk, "content", chunk)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return ""


class LangChainProvider:
    """Gemini with a Groq fallback, assembled by LangChain's ``with_fallbacks``."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._chain: Any = None

    @property
    def name(self) -> str:
        return "langchain:gemini+groq"

    @property
    def configured(self) -> bool:
        # Either leg is enough — with_fallbacks tolerates the other being absent.
        return self._settings.gemini_configured or self._settings.groq_configured

    def _build(self) -> Any:
        """Construct the runnable once, on first call rather than at startup.

        Keeps the 20s+ import off the boot path for deployments that have this
        provider configured but never reach it, because Gemini ahead of it in
        the chain is healthy.
        """
        if self._chain is not None:
            return self._chain

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_groq import ChatGroq
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise GenerationError(f"langchain provider unavailable: {exc}") from exc

        legs = []
        if self._settings.gemini_configured:
            # Same ceiling arithmetic as the native client: reasoning tokens are
            # charged against this budget, so the answer's allowance has to be
            # added to a reasoning allowance rather than shared with it.
            log.warning(
                "langchain Gemini leg cannot set thinkingLevel — reasoning is not held down on "
                "this path, only paid for. Verify thoughtsTokenCount before serving visitors.",
                extra={"event": "startup", "provider": "langchain:gemini"},
            )
            legs.append(
                ChatGoogleGenerativeAI(
                    model=self._settings.gemini_model,
                    google_api_key=self._settings.gemini_api_key,
                    temperature=0.2,
                    max_output_tokens=(
                        self._settings.llm_max_output_tokens
                        + self._settings.gemini_thinking_headroom_tokens
                    ),
                    timeout=self._settings.llm_timeout_seconds,
                )
            )
        if self._settings.groq_configured:
            legs.append(
                ChatGroq(
                    model=self._settings.groq_model,
                    api_key=self._settings.groq_api_key,
                    temperature=0.2,
                    max_tokens=self._settings.llm_max_output_tokens,
                    timeout=self._settings.llm_timeout_seconds,
                )
            )

        if not legs:
            raise GenerationError("no langchain leg is configured")

        # This is the requested LangChain fallback: the head runnable, with the
        # remainder tried in order when it raises.
        self._chain = legs[0] if len(legs) == 1 else legs[0].with_fallbacks(legs[1:])
        return self._chain

    async def generate(self, messages: list[dict[str, str]]) -> str:
        chain = self._build()
        try:
            result = await chain.ainvoke(to_langchain_messages(messages))
        except Exception as exc:  # noqa: BLE001 — any vendor/SDK failure is one signal here
            raise GenerationError(f"langchain generate failed: {type(exc).__name__}") from exc

        text = _content_of(result).strip()
        if not text:
            raise GenerationError("langchain returned an empty completion")
        return text

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        chain = self._build()
        try:
            async for chunk in chain.astream(to_langchain_messages(messages)):
                fragment = _content_of(chunk)
                if fragment:
                    yield fragment
        except Exception as exc:  # noqa: BLE001
            raise GenerationError(f"langchain stream failed: {type(exc).__name__}") from exc
