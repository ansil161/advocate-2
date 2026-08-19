"""In-process metrics for the admin dashboard: what happened, never what was said.

Every completed turn contributes one record here — timings, which provider
answered, how many chunks were used, whether a fallback fired. What it
deliberately does not contribute is the visitor's question or the assistant's
answer. A law firm's site attracts people describing arrests, debts and family
matters; a rolling buffer of those sentences sitting in a web process is a
liability with no operational upside, and "we only keep the last 500" is not a
defence anyone would want to make. Everything here is a number, an enum or a
short identifier.

**Bounded and in-process, like the rate limiter and the conversation store.**
There is no Redis in this project, so with N workers each holds its own window
and the dashboard shows one worker's view. That is stated on the endpoint rather
than hidden, because a percentile that silently describes a third of the traffic
is worse than one labelled as such. The registry is the seam a real metrics
backend replaces later: callers only ever touch ``record()``.

Percentiles use nearest-rank on the retained window. With a few hundred samples
that is accurate enough to answer the question anyone actually asks it — "is p95
seconds or milliseconds" — and it needs no dependency.
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import asdict, dataclass, field
from threading import Lock

# How many recent turns are retained. Large enough that p95 means something,
# small enough that the whole window is a few hundred KB of plain scalars.
WINDOW = 500

# Recent failures kept for the dashboard's "recent RAG errors" panel. Short,
# because this is a live-triage aid rather than a log store — the structured
# logs remain the durable record.
ERROR_WINDOW = 25


@dataclass(frozen=True)
class TurnRecord:
    """One completed chat turn, reduced to non-identifying facts."""

    request_id: str
    # Truncated to 8 characters, matching the chat log. Enough to correlate a
    # dashboard row with a log line, far too little to be an identifier.
    conversation: str
    mode: str
    strategy: str
    confidence: str
    provider: str
    model: str
    chunks_retrieved: int
    chunks_used: int
    degraded: bool
    total_ms: float
    retrieval_ms: float
    rerank_ms: float
    llm_ms: float
    # Error code only — never the upstream's message, which can quote the
    # request back and is already handled by the structured logger.
    error: str = ""


@dataclass
class _Percentiles:
    p50: float = 0.0
    p95: float = 0.0
    p99: float = 0.0


def percentiles(values: list[float]) -> _Percentiles:
    """Nearest-rank percentiles over an unsorted sample.

    Returns zeros for an empty sample rather than raising: a dashboard asking
    for latency before any traffic has arrived is a normal state, not an error.
    """
    if not values:
        return _Percentiles()
    ordered = sorted(values)

    def at(fraction: float) -> float:
        # Nearest-rank: ceil(fraction * n), clamped into the list.
        rank = max(1, min(len(ordered), int(-(-len(ordered) * fraction // 1))))
        return round(ordered[rank - 1], 2)

    return _Percentiles(p50=at(0.50), p95=at(0.95), p99=at(0.99))


@dataclass
class _Counters:
    turns: int = 0
    generated: int = 0
    quoted: int = 0
    no_context: int = 0
    degraded: int = 0
    errors: int = 0
    by_provider: dict[str, int] = field(default_factory=dict)


class MetricsRegistry:
    """A bounded, thread-safe window of recent turns.

    Locked because uvicorn may serve requests from a thread pool and a deque
    plus a counter dict are not atomic together. The critical sections are a
    handful of appends, so contention is not a consideration at this traffic.
    """

    def __init__(self, window: int = WINDOW) -> None:
        self._turns: deque[TurnRecord] = deque(maxlen=window)
        self._errors: deque[TurnRecord] = deque(maxlen=ERROR_WINDOW)
        self._counters = _Counters()
        self._lock = Lock()
        self._started = time.time()

    def record(self, turn: TurnRecord) -> None:
        with self._lock:
            self._turns.append(turn)
            counters = self._counters
            counters.turns += 1
            if turn.mode == "generated":
                counters.generated += 1
            elif turn.mode == "quoted":
                counters.quoted += 1
            elif turn.mode == "no_context":
                counters.no_context += 1
            if turn.degraded:
                counters.degraded += 1
            if turn.error:
                counters.errors += 1
                self._errors.append(turn)
            if turn.provider:
                counters.by_provider[turn.provider] = counters.by_provider.get(turn.provider, 0) + 1

    def snapshot(self) -> dict:
        """Everything the dashboard needs, computed on demand.

        Computed here rather than maintained incrementally because percentiles
        cannot be updated in place without keeping the sample anyway, and the
        window is small enough that sorting it per request is free.
        """
        with self._lock:
            turns = list(self._turns)
            errors = list(self._errors)
            counters = _Counters(
                turns=self._counters.turns,
                generated=self._counters.generated,
                quoted=self._counters.quoted,
                no_context=self._counters.no_context,
                degraded=self._counters.degraded,
                errors=self._counters.errors,
                by_provider=dict(self._counters.by_provider),
            )
            uptime = time.time() - self._started

        return {
            "window": len(turns),
            "window_limit": self._turns.maxlen,
            "uptime_seconds": round(uptime),
            "totals": asdict(counters),
            "latency_ms": {
                "total": asdict(percentiles([t.total_ms for t in turns])),
                "retrieval": asdict(percentiles([t.retrieval_ms for t in turns])),
                "llm": asdict(percentiles([t.llm_ms for t in turns if t.llm_ms > 0])),
            },
            "recent_errors": [asdict(t) for t in reversed(errors)],
            "recent_turns": [asdict(t) for t in list(reversed(turns))[:20]],
            # Stated rather than implied: with more than one worker these numbers
            # describe whichever process answered the dashboard's own request.
            "scope": "single process — with multiple workers each holds its own window",
        }
