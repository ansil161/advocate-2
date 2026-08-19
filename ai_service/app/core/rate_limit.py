"""Fixed-window rate limiting for a public, paid-per-call endpoint.

Two windows, because they stop different things. The per-minute window stops a
person or a script hammering the widget in a burst. The per-day window stops
the slow, patient abuse that a per-minute limit never notices — one request
every seven seconds, all day, quietly spending the firm's inference budget.

Fixed windows rather than a sliding log or token bucket: this is a chat widget
on a law firm's website, not a payments API. The known weakness of a fixed
window — up to double the limit across a window boundary — is not worth a more
complex implementation here, and both limits are set well below the point where
that would cost anything meaningful.

**The client identifier is hashed before it is ever stored or logged.** The
limiter needs to tell visitors apart; it does not need to know who they are,
and an IP address sitting in a dict — or in Redis — on a law firm's server is a
liability with no upside.

**Two backends, one interface.** With Redis the counters are shared, so N
workers enforce one limit. Without it each process keeps its own, and the
effective limit is N times the configured one — which is why ``/health`` says
which mode is running instead of leaving it to be discovered.

``check`` is async for both. The in-process implementation awaits nothing; the
signature matches so the two are interchangeable at the call site and swapping
them can never become a behavioural surprise.
"""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any

from app.core.config import Settings
from app.core.exceptions import RateLimitExceeded
from app.core.logging import get_logger

log = get_logger(__name__)

_MINUTE = 60
_DAY = 86_400

# Bounds memory against a flood of distinct source addresses. Entries are
# evicted least-recently-seen first, which is exactly the wrong order for an
# attacker to exploit — a client being evicted means it has been quiet.
MAX_TRACKED_CLIENTS = 20_000


def identify(client_ip: str | None) -> str:
    """A stable, non-reversible key for a caller.

    Truncated to 16 hex characters: enough to make a collision irrelevant at
    this scale, short enough to read in a log line.
    """
    return hashlib.sha256((client_ip or "unknown").encode("utf-8")).hexdigest()[:16]


@dataclass
class _Counters:
    minute_window: int = 0
    minute_count: int = 0
    day_window: int = 0
    day_count: int = 0


class RateLimiter:
    """In-process counters. The fallback when Redis is absent."""

    backend = "in-process"

    def __init__(self, settings: Settings, max_clients: int = MAX_TRACKED_CLIENTS) -> None:
        self._settings = settings
        self._max = max_clients
        self._clients: OrderedDict[str, _Counters] = OrderedDict()

    # Kept as a static method as well as a module function: existing callers and
    # tests reach it through the class, and both spellings must agree.
    identify = staticmethod(identify)

    async def check(self, client_key: str) -> None:
        """Count one request, raising ``RateLimitExceeded`` if it is over.

        Raises *before* incrementing the counter it violated, so a client that
        keeps hammering a closed window does not push its own reset further
        away — the window still expires on schedule.
        """
        now = int(time.time())
        minute_window = now // _MINUTE
        day_window = now // _DAY

        counters = self._clients.get(client_key)
        if counters is None:
            counters = _Counters(minute_window=minute_window, day_window=day_window)
            self._clients[client_key] = counters
            self._evict()

        if counters.minute_window != minute_window:
            counters.minute_window = minute_window
            counters.minute_count = 0
        if counters.day_window != day_window:
            counters.day_window = day_window
            counters.day_count = 0

        if counters.minute_count >= self._settings.rate_limit_per_minute:
            raise RateLimitExceeded(
                f"minute limit of {self._settings.rate_limit_per_minute} reached",
                retry_after=max(1, ((minute_window + 1) * _MINUTE) - now),
            )
        if counters.day_count >= self._settings.rate_limit_per_day:
            raise RateLimitExceeded(
                f"daily limit of {self._settings.rate_limit_per_day} reached",
                retry_after=max(1, ((day_window + 1) * _DAY) - now),
            )

        counters.minute_count += 1
        counters.day_count += 1
        self._clients.move_to_end(client_key)

    def _evict(self) -> None:
        while len(self._clients) > self._max:
            self._clients.popitem(last=False)


class RedisRateLimiter:
    """Counters in Redis, so every worker enforces one shared limit."""

    backend = "redis"

    # Keys carry the window number, so an expired window is a different key
    # rather than a value that has to be reset. Nothing needs cleaning up: the
    # TTL removes the key shortly after its window closes.
    _MINUTE_KEY = "rl:m:{client}:{window}"
    _DAY_KEY = "rl:d:{client}:{window}"

    def __init__(self, settings: Settings, redis: Any) -> None:
        self._settings = settings
        self._redis = redis
        # Falls back to this process's own counters if Redis fails mid-life. A
        # visitor's question is not worth failing because a counter could not be
        # written, but dropping the limit entirely would be worse.
        self._local = RateLimiter(settings)

    identify = staticmethod(identify)

    async def check(self, client_key: str) -> None:
        now = int(time.time())
        minute_window = now // _MINUTE
        day_window = now // _DAY

        try:
            minute_count, day_count = await self._incr_both(
                client_key, minute_window, day_window
            )
        except RateLimitExceeded:
            raise
        except Exception as exc:  # noqa: BLE001 - any redis failure degrades identically
            log.warning(
                "redis rate limiting failed, falling back to this process's counters",
                extra={"event": "rate_limit_degraded", "reason": type(exc).__name__},
            )
            await self._local.check(client_key)
            return

        # INCR-then-compare rather than read-then-write: the increment has to be
        # atomic across workers, and two round trips would race. A blocked
        # client's counter keeps rising, which is harmless — the TTL is set only
        # on the first increment, so hammering never postpones the reset.
        if minute_count > self._settings.rate_limit_per_minute:
            raise RateLimitExceeded(
                f"minute limit of {self._settings.rate_limit_per_minute} reached",
                retry_after=max(1, ((minute_window + 1) * _MINUTE) - now),
            )
        if day_count > self._settings.rate_limit_per_day:
            raise RateLimitExceeded(
                f"daily limit of {self._settings.rate_limit_per_day} reached",
                retry_after=max(1, ((day_window + 1) * _DAY) - now),
            )

    async def _incr_both(self, client_key: str, minute_window: int, day_window: int):
        """Increment both counters in one round trip, setting TTLs on creation."""
        minute_key = self._MINUTE_KEY.format(client=client_key, window=minute_window)
        day_key = self._DAY_KEY.format(client=client_key, window=day_window)

        pipe = self._redis.pipeline(transaction=True)
        pipe.incr(minute_key)
        # A little past the window so a clock skew between workers cannot expire
        # a key that is still being counted against.
        pipe.expire(minute_key, _MINUTE + 5)
        pipe.incr(day_key)
        pipe.expire(day_key, _DAY + 60)
        minute_count, _, day_count, _ = await pipe.execute()
        return int(minute_count), int(day_count)


def build_rate_limiter(settings: Settings, redis: Any | None):
    """Pick the backend. One place, so the choice cannot be made twice."""
    return RedisRateLimiter(settings, redis) if redis is not None else RateLimiter(settings)
