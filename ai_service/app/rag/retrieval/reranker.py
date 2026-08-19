"""Reranking: a second, more expensive opinion on the fused candidates.

Retrieval and reranking answer different questions. Embedding search asks "is
this chunk *about* the same thing as the query", which is why "who is the
founder" surfaces the firm's story, its community page and the founder's
profile at almost identical scores — all three are about the firm's origins.
Reranking asks "does this chunk *answer* this question", which separates them.

**Why not a cross-encoder.** The usual answer is a local cross-encoder
(bge-reranker, ms-marco MiniLM). This service's `requirements.txt` excludes
torch and sentence-transformers on purpose — it is deployed as a small,
weightless container that calls hosted inference. Adding a local reranker would
pull in a multi-hundred-megabyte dependency and model weights, which is a much
larger architectural change than the accuracy is worth here. So the LLM that is
already in the request path does the job instead.

**One call, not N.** Scoring each candidate separately would multiply latency
by the candidate count. All candidates go in one prompt and come back as one
array of scores.

**Failure is never fatal.** A reranker that errors, times out or returns
garbage falls back to the RRF ordering. Reranking improves an answer; it must
never be able to prevent one.
"""

from __future__ import annotations

import json
import re
import time
from typing import Protocol

from app.core.config import Settings
from app.core.exceptions import GenerationError
from app.core.logging import get_logger
from app.rag.retrieval.rrf import FusedHit

log = get_logger(__name__)

# How much of each chunk the reranker sees. Enough to judge relevance, short
# enough that 25 candidates stay well inside a single prompt.
SNIPPET_CHARS = 400

_RERANK_SYSTEM = (
    "You score how well each numbered passage answers a question about a law firm. "
    "Reply with JSON only: an array of objects with keys \"i\" (the passage number) "
    "and \"s\" (a relevance score from 0 to 10). "
    "10 means the passage directly and completely answers the question. "
    "5 means it is related but does not answer it. "
    "0 means it is irrelevant. "
    "Score every passage. Output nothing but the JSON array."
)

# Models wrap JSON in prose or fences often enough that locating the array is
# more reliable than insisting the whole response parse.
_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)


class Reranker(Protocol):
    # Whether this implementation actually reorders anything. The retrieval
    # tester reads it to distinguish "the reranker ran and agreed with fusion"
    # from "no reranker is configured" — two states that look identical in the
    # output and mean opposite things when tuning.
    enabled: bool

    async def rerank(self, query: str, hits: list[FusedHit]) -> list[FusedHit]: ...

    @property
    def name(self) -> str: ...


class NoOpReranker:
    """Keeps the fused order. The default, and the fallback when reranking fails."""

    enabled = False

    @property
    def name(self) -> str:
        return "none"

    async def rerank(self, query: str, hits: list[FusedHit]) -> list[FusedHit]:
        return hits


def build_prompt(query: str, hits: list[FusedHit]) -> list[dict[str, str]]:
    passages = "\n\n".join(
        f"[{index}] {hit.hit.text[:SNIPPET_CHARS]}" for index, hit in enumerate(hits, start=1)
    )
    return [
        {"role": "system", "content": _RERANK_SYSTEM},
        {"role": "user", "content": f"Question: {query}\n\nPassages:\n{passages}"},
    ]


def parse_scores(raw: str, expected: int) -> dict[int, float]:
    """Pull ``{index: score}`` out of a model response, tolerating stray prose.

    Indices outside the candidate range are dropped rather than clamped — a
    model inventing passage 47 is confused, and quietly reinterpreting that as
    passage 5 would silently corrupt the ranking.
    """
    match = _JSON_ARRAY_RE.search(raw)
    if not match:
        raise ValueError("no JSON array in rerank response")

    parsed = json.loads(match.group(0))
    if not isinstance(parsed, list):
        raise ValueError("rerank response was not a list")

    scores: dict[int, float] = {}
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        try:
            index = int(entry["i"])
            score = float(entry["s"])
        except (KeyError, TypeError, ValueError):
            continue
        if 1 <= index <= expected:
            # Normalised to 0..1 so it sits on the same scale as cosine and can
            # be compared against a confidence threshold.
            scores[index] = max(0.0, min(10.0, score)) / 10.0
    return scores


class LLMReranker:
    """Scores candidates with a small, fast model from the existing provider chain."""

    enabled = True

    def __init__(self, settings: Settings, llm) -> None:  # noqa: ANN001 - LLMService, avoids a cycle
        self._settings = settings
        self._llm = llm

    @property
    def name(self) -> str:
        return "llm"

    async def rerank(self, query: str, hits: list[FusedHit]) -> list[FusedHit]:
        if len(hits) < 2:
            return hits

        started = time.perf_counter()
        try:
            raw, _model = await self._llm.generate(build_prompt(query, hits))
            scores = parse_scores(raw, len(hits))
        except (GenerationError, ValueError, json.JSONDecodeError) as exc:
            log.warning(
                "rerank failed, keeping fused order",
                extra={"event": "rerank_failed", "reason": str(exc)[:120]},
            )
            return hits

        if not scores:
            log.warning("rerank returned no usable scores", extra={"event": "rerank_empty"})
            return hits

        scored = [
            hit.with_rerank(scores[index]) if index in scores else hit
            for index, hit in enumerate(hits, start=1)
        ]
        # Unscored candidates keep their fused position by falling back to the
        # RRF score, rather than being dropped for the model's omission.
        scored.sort(key=lambda f: (f.rerank_score if f.rerank_score is not None else -1.0, f.rrf_score), reverse=True)

        log.info(
            "rerank complete",
            extra={
                "event": "rerank",
                "chunks": len(hits),
                "scored": len(scores),
                "duration_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        return scored


def build_reranker(settings: Settings, llm) -> Reranker:  # noqa: ANN001
    """Resolve ``RAG_RERANKER``. Unknown values degrade to no-op with a warning."""
    choice = settings.rag_reranker.strip().lower()
    if choice in {"", "none", "off"}:
        return NoOpReranker()
    if choice == "llm":
        return LLMReranker(settings, llm)
    log.warning(
        "unknown RAG_RERANKER, reranking disabled",
        extra={"event": "startup", "reason": choice},
    )
    return NoOpReranker()
