"""A per-provider circuit breaker, so one dead upstream stops costing latency.

Without this, a provider that is down is still *tried* on every request. Each
attempt burns its full retry budget and timeout before failover begins, so the
visitor waits for the broken provider three times over before the working one
is even called. The breaker remembers that it is broken.

The states are the conventional three:

    CLOSED ──failures ≥ threshold──▶ OPEN
       ▲                              │
       │                         cooldown elapsed
       └──success── HALF_OPEN ◀───────┘
                        │
                    failure
                        └──▶ OPEN (cooldown restarts)

HALF_OPEN admits exactly one probe. That matters: letting the whole request
flow through the moment the cooldown expires turns a still-broken provider back
into a stampede, and the failures reopen the breaker having achieved nothing
but a burst of latency for whoever happened to be asking.

Deliberately in-process. A shared breaker across workers would need Redis and
would couple every request to it; the cost of each worker independently
discovering the same outage is one probe per cooldown per worker, which is far
cheaper than the coordination.
"""

from __future__ import annotations

import time
from enum import Enum

from app.core.logging import get_logger

log = get_logger(__name__)


class State(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Failure accounting for one named upstream.

    Not thread-safe, and does not need to be: it is touched only from the event
    loop, and the worst case for a torn read is one extra probe.
    """

    def __init__(
        self,
        name: str,
        *,
        failure_threshold: int = 3,
        cooldown_seconds: float = 30.0,
    ) -> None:
        self._name = name
        self._threshold = failure_threshold
        self._cooldown = cooldown_seconds

        self._failures = 0
        self._opened_at = 0.0
        self._state = State.CLOSED
        # Set while a HALF_OPEN probe is in flight, so a second concurrent
        # request does not also get admitted as "the one probe".
        self._probing = False

    @property
    def name(self) -> str:
        return self._name

    @property
    def state(self) -> State:
        return self._state

    def allows(self) -> bool:
        """Whether a call may be attempted right now.

        Also performs the OPEN → HALF_OPEN transition, because the cooldown can
        only be found to have elapsed by someone asking.
        """
        if self._state is State.CLOSED:
            return True

        if self._state is State.OPEN:
            if (time.monotonic() - self._opened_at) < self._cooldown:
                return False
            self._state = State.HALF_OPEN
            self._probing = False
            log.info(
                "circuit breaker probing after cooldown",
                extra={"event": "circuit_half_open", "provider": self._name},
            )

        # HALF_OPEN: admit a single probe.
        if self._probing:
            return False
        self._probing = True
        return True

    def record_success(self) -> None:
        was = self._state
        self._failures = 0
        self._probing = False
        self._state = State.CLOSED
        if was is not State.CLOSED:
            log.info(
                "circuit breaker closed",
                extra={"event": "circuit_closed", "provider": self._name},
            )

    def record_failure(self) -> None:
        self._probing = False

        # A failed probe means the upstream is still broken. Straight back to
        # OPEN with a fresh cooldown, without waiting to re-accumulate the
        # whole failure threshold one probe at a time.
        if self._state is State.HALF_OPEN:
            self._trip()
            return

        self._failures += 1
        if self._failures >= self._threshold:
            self._trip()

    def _trip(self) -> None:
        self._state = State.OPEN
        self._opened_at = time.monotonic()
        log.warning(
            "circuit breaker opened",
            extra={
                "event": "circuit_open",
                "provider": self._name,
                "failures": self._failures,
                "cooldown_s": self._cooldown,
            },
        )

    def snapshot(self) -> dict[str, object]:
        """Safe to expose on /health — carries no credentials and no content."""
        return {
            "provider": self._name,
            "state": self._state.value,
            "failures": self._failures,
        }
