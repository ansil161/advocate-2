"""The chat endpoint.

Kept deliberately thin. Validation is the schema's job, grounding is the chat
service's, and this layer does only what genuinely belongs at the HTTP
boundary: count the request against the limiter, call the service, and turn a
typed failure into a safe response.

The one rule it enforces on the way out is that a visitor sees
``error.public_message`` and nothing else. ``exc.detail`` — which carries the
upstream status, the provider's words, the exception type — goes to the log and
stops there.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse

from app.core.exceptions import ChatError, RateLimitExceeded
from app.core.logging import get_logger
from app.core.rate_limit import RateLimiter
from app.api.schemas.chat import ChatRequest, ChatResponse, OpeningResponse, SourceOut
from app.api.schemas.common import ErrorBody, ErrorResponse
from app.services.chat_service import ChatService
from app.api.deps import client_key, get_chat_service, get_rate_limiter

log = get_logger(__name__)

router = APIRouter(tags=["chat"])

# Shown above the suggested questions when the panel is first opened. Kept
# beside the endpoint that serves it rather than in the widget, so the firm's
# opening line can be changed without a frontend deploy.
GREETING = (
    "Welcome to SLA Advocates. I can help you explore the firm's practice areas, "
    "its advocates, its experience and how to get in touch."
)


@router.get("/chat/opening", response_model=OpeningResponse)
async def opening(chat: ChatService = Depends(get_chat_service)) -> OpeningResponse:
    """The panel's initial state.

    A GET with no side effects and no upstream calls, so opening the widget
    costs nothing and cannot fail in a way that matters.
    """
    return OpeningResponse(greeting=GREETING, suggested_questions=chat.opening_suggestions())


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={
        429: {"model": ErrorResponse, "description": "Rate limit exceeded"},
        503: {"model": ErrorResponse, "description": "Assistant temporarily unavailable"},
    },
)
async def chat_endpoint(
    payload: ChatRequest,
    response: Response,
    chat: ChatService = Depends(get_chat_service),
    limiter: RateLimiter = Depends(get_rate_limiter),
    caller: str = Depends(client_key),
) -> ChatResponse | Response:
    try:
        await limiter.check(caller)
    except RateLimitExceeded as exc:
        log.warning(
            "rate limit hit",
            extra={"event": "rate_limited", "client_hash": caller, "reason": exc.detail},
        )
        return _error_response(exc, headers={"Retry-After": str(exc.retry_after)})

    try:
        result = await chat.answer(payload.message, payload.conversation_id)
    except ChatError as exc:
        # The chat service handles its own degradation, so reaching here means
        # something outside the fallback chain failed.
        log.error(
            "chat request failed",
            extra={"event": "chat_failed", "reason": exc.detail, "status": exc.code},
        )
        return _error_response(exc)

    # Not cacheable by anything in between: the reply depends on conversation
    # state the cache cannot see, and it is a person's question either way.
    response.headers["Cache-Control"] = "no-store"

    return ChatResponse(
        answer=result.answer,
        conversation_id=result.conversation_id,
        sources=[SourceOut(title=s.title, section=s.section, url=s.url) for s in result.sources],
        suggested_questions=result.suggested_questions,
        mode=result.mode,
        degraded=result.degraded,
    )


def _error_response(exc: ChatError, headers: dict[str, str] | None = None) -> Response:
    """Render a typed failure as the service's single error shape."""
    body = ErrorResponse(error=ErrorBody(code=exc.code, message=exc.public_message))
    return JSONResponse(status_code=exc.http_status, content=body.model_dump(), headers=headers)
