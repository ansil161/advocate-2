"""The contract every generation provider satisfies.

The RAG layer must not know which vendor answered. That is the whole point of
this file: ``LLMService`` iterates over ``ChatProvider`` objects and asks each
one the same question, so adding Groq or swapping Gemini for OpenAI is a new
module here and one entry in a config list, not an edit to the retrieval,
prompt or chat code.

Messages cross this boundary in the OpenAI shape — ``{"role", "content"}`` with
roles ``system``/``user``/``assistant`` — because it is the format the prompt
builder already produces and the one most providers accept natively. A provider
whose API disagrees (Gemini does) translates inbound, in its own module, where
the translation can be tested against that vendor's rules alone.
"""

from __future__ import annotations

from typing import AsyncIterator, Protocol, runtime_checkable


@runtime_checkable
class ChatProvider(Protocol):
    """One generation backend."""

    @property
    def name(self) -> str:
        """Stable identifier used in logs, metrics and health output."""
        ...

    @property
    def configured(self) -> bool:
        """Whether this provider has the credentials it needs.

        Checked rather than asserted, so an unconfigured provider is skipped
        during failover instead of raising and taking the request with it.
        """
        ...

    async def generate(self, messages: list[dict[str, str]]) -> str:
        """Return the completion text, or raise ``GenerationError``."""
        ...

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Yield completion text incrementally, or raise ``GenerationError``."""
        ...
