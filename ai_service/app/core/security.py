"""Authentication primitives, independent of any route.

Currently one job: the shared secret guarding the server-to-server indexing and
diagnostics API that Django calls. It was defined inside
``api/routes/internal.py``, which meant the service's only authentication rule
was written in the same file as the endpoints it protects and could not be
reviewed, reused or tested without importing FastAPI routing.

Deliberately *not* here: the hashed caller identifier the rate limiter buckets
on. That already exists as ``RateLimiter.identify`` and re-homing it would have
meant two implementations of one hash — a worse problem than the tidiness it
would have bought.

Nothing here knows what a route is. The functions raise plain Python exceptions
and the API layer translates them into status codes, so this module stays
usable from a script or a worker.
"""

from __future__ import annotations

import secrets

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)


class InternalAuthUnavailable(RuntimeError):
    """No shared secret is configured, so the internal API is closed."""


class InternalAuthFailed(PermissionError):
    """A shared secret was supplied and did not match."""


def verify_internal_key(supplied: str, settings: Settings, *, path: str = "") -> None:
    """Check a caller's shared secret, in constant time.

    An unset secret **closes** the endpoint rather than opening it. The opposite
    default — no key configured means no check — is how an internal API ends up
    publicly writable on the one deployment where someone forgot to set it.
    """
    expected = settings.internal_api_key.strip()
    if not expected:
        raise InternalAuthUnavailable("internal API is not configured")

    # Constant-time: a plain == leaks the secret's prefix through timing to
    # anything that can call this endpoint repeatedly.
    if not secrets.compare_digest(supplied, expected):
        log.warning(
            "internal API rejected a request",
            extra={"event": "internal_auth_failed", "path": path},
        )
        raise InternalAuthFailed("unauthorized")
