"""Request-scoped accessors for the objects built once at startup.

Everything expensive — the HTTP pool, the Qdrant connection, the lexical index,
the conversation store — is constructed in the app's lifespan and hung on
``app.state``. These functions are the only way routes reach them, which keeps
the routes free of any knowledge of how the service is assembled and makes each
one trivially replaceable in a test.
"""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings
from app.core.rate_limit import RateLimiter
from app.services.chat_service import ChatService


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_chat_service(request: Request) -> ChatService:
    return request.app.state.chat_service


def get_rate_limiter(request: Request) -> RateLimiter:
    return request.app.state.rate_limiter


def client_key(request: Request) -> str:
    """A hashed, non-reversible identifier for the caller.

    Behind a reverse proxy every request appears to come from the proxy, so the
    forwarded header has to be read — but only when the deployment says there
    *is* a trusted proxy. Reading it unconditionally would let any caller
    choose their own rate-limit bucket by setting a header, which is worse than
    having no limiter at all: it looks like it is working.

    The leftmost entry is taken because that is the original client; entries to
    its right are the proxies it passed through.
    """
    settings: Settings = request.app.state.settings
    ip: str | None = request.client.host if request.client else None

    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            ip = forwarded.split(",")[0].strip() or ip

    return RateLimiter.identify(ip)
