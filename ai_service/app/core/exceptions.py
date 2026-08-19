"""Typed failures, and the sentences visitors are allowed to see.

Two rules shape this module.

The first is that no upstream detail ever reaches a visitor. A Qdrant timeout,
a Hugging Face 503 and a malformed model response are all real and all worth
logging, but to someone asking about a partition suit they are the same event:
the assistant could not answer. Each exception therefore carries its own
``public_message``, and the route layer is not permitted to render anything
else — which is what keeps stack traces, provider names, URLs and model ids out
of the response body.

The second is that most of these are *not* fatal. ``EmbeddingError``,
``VectorStoreError`` and ``GenerationError`` are raised deep in the stack and
caught by the chat service, which uses them to choose the next fallback layer
rather than to fail the request. Only ``RateLimitExceeded`` and
``AssistantUnavailable`` are ever rendered as a non-200 response.
"""

from __future__ import annotations

from app.core import messages


class ChatError(Exception):
    """Base class for every failure this service raises deliberately.

    ``code`` is for logs and for the client's own branching; ``public_message``
    is the only string that may be shown to a visitor.
    """

    code: str = "chat_error"
    http_status: int = 500
    public_message: str = messages.UNAVAILABLE

    def __init__(self, detail: str = "") -> None:
        # `detail` is the operator-facing half: it goes to the log record and
        # never to the response body.
        super().__init__(detail or self.__class__.__name__)
        self.detail = detail


class EmbeddingError(ChatError):
    """The query could not be turned into a vector.

    Caught by the retrieval service, which falls back to lexical matching over
    the same corpus rather than giving up on retrieval altogether.
    """

    code = "embedding_failed"


class VectorStoreError(ChatError):
    """Qdrant was unreachable, or refused the search."""

    code = "vector_store_failed"


class GenerationError(ChatError):
    """Every configured chat model failed or timed out.

    Caught by the chat service, which quotes retrieved context directly instead
    of composing an answer.
    """

    code = "generation_failed"
    public_message = messages.GENERATION_FAILED


class RateLimitExceeded(ChatError):
    """Rendered to the visitor as a 429."""

    code = "rate_limited"
    http_status = 429
    public_message = messages.RATE_LIMITED

    def __init__(self, detail: str = "", retry_after: int = 60) -> None:
        super().__init__(detail)
        # Surfaced as a Retry-After header so a well-behaved client backs off
        # for the right length of time instead of guessing.
        self.retry_after = retry_after


class AssistantUnavailable(ChatError):
    """Nothing worked — not retrieval, not generation, not the quote fallback."""

    code = "assistant_unavailable"
    http_status = 503
