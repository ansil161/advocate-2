"""Redis connection, and the decision to make it optional.

Redis is what turns three per-process caches into shared state: the rate limiter
now counts a visitor once across every worker, a conversation is remembered by
whichever worker answers the next message, and the metrics window describes the
whole deployment rather than one process.

**It is optional on purpose.** ``REDIS_URL`` unset, or a Redis that cannot be
reached at startup, falls back to the in-process implementations that were here
before. That is not indecision — it is the same rule the rest of this service
follows: a missing dependency degrades the assistant and says so on ``/health``,
rather than crash-looping a container and taking the whole widget offline. It
also means the suite and a local dev run need no server.

What the fallback costs is stated wherever it applies: with N workers and no
Redis, the rate limit is effectively N times the configured one. That is a real
consequence, so ``/health`` reports which mode is active rather than leaving an
operator to infer it.

**Failures after startup do not raise.** ``ping()`` is checked once when the
process boots and the choice is made there. If Redis dies mid-life the callers
catch and degrade per operation — a visitor's question is not worth failing
because a counter could not be written.
"""

from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.core.logging import get_logger

log = get_logger(__name__)

# Bounded so a Redis that is merely slow cannot hold a request open. Every
# operation here is a single small command; if one takes longer than this,
# something is wrong and degrading is better than waiting.
SOCKET_TIMEOUT_SECONDS = 2.0


async def connect(settings: Settings) -> Any | None:
    """Return a live async Redis client, or ``None`` to use in-process state.

    Returns ``None`` rather than raising for both "not configured" and
    "configured but unreachable", because the caller's response to each is the
    same: run with local state and report it.
    """
    url = settings.redis_url.strip()
    if not url:
        log.info(
            "REDIS_URL is not set — using in-process rate limiting, conversation memory "
            "and metrics. Run a single worker, or set REDIS_URL to share them.",
            extra={"event": "startup", "reason": "redis_unconfigured"},
        )
        return None

    try:
        from redis.asyncio import Redis
    except ImportError:  # pragma: no cover - depends on environment
        log.warning(
            "REDIS_URL is set but the redis package is not installed — falling back to "
            "in-process state",
            extra={"event": "startup", "reason": "redis_not_installed"},
        )
        return None

    try:
        client = Redis.from_url(
            url,
            # Every value this service stores is text (JSON or an integer), so
            # decoding here keeps the call sites free of .decode() noise.
            decode_responses=True,
            socket_timeout=SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=SOCKET_TIMEOUT_SECONDS,
            health_check_interval=30,
        )
        await client.ping()
    except Exception as exc:  # noqa: BLE001 - any connection failure degrades identically
        log.warning(
            "REDIS_URL is set but Redis could not be reached — falling back to in-process state",
            extra={"event": "startup", "reason": type(exc).__name__},
        )
        return None

    log.info("redis connected", extra={"event": "startup", "status": "redis"})
    return client
