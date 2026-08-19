"""Retrieval: turn a question into approved passages, or into nothing at all.

Returning nothing is a first-class outcome here, not a failure. Everything
downstream is built so that an empty result produces the "I don't have enough
verified information" reply — so the confidence policy in this pipeline is the
mechanism that actually prevents the assistant from inventing answers about a
law firm. Loosening it does not make the assistant smarter; it makes it willing
to answer from whatever happened to be closest.

The pipeline, for a healthy request::

    query ─┬─▶ vector search (Qdrant, cosine) ─┐
           │                                    ├─▶ RRF ─▶ rerank ─▶ confidence
           └─▶ keyword search (in-process BM25)─┘                        │
                                                                         ▼
                                                         context builder ─▶ prompt

Both branches run concurrently, because they are independent and the slower of
the two is the only latency that matters.

**Why BM25 is in-process rather than a Qdrant full-text index.** The corpus is
63 chunks; scoring all of them is a few hundred microseconds against a network
round trip, and the in-memory index already existed and is already loaded. If
the knowledge base grows past a few thousand chunks — which the admin panel
makes possible — this is the piece to move into Qdrant, and the branch is
isolated here so that change touches one method.

**Degradation is layered, and never silent.** If embedding fails, the keyword
branch alone still answers from the same approved corpus and the result is
marked degraded. If the vector store fails, likewise. Only when both fail, or
when confidence comes back LOW, does retrieval return nothing.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

from app.core.types import SearchHit
from app.core.config import Settings
from app.core.exceptions import EmbeddingError, VectorStoreError
from app.core.logging import get_logger
from app.conversation.rewriter import build_search_query
from app.rag.confidence.scorer import Assessment, Confidence, assess
from app.rag.context.builder import BuiltContext, build_context
from app.rag.retrieval.rrf import FusedHit, reciprocal_rank_fusion
from app.rag.retrieval.keyword import LexicalIndex
from app.guardrails.input import looks_like_personal_matter
from app.rag.retrieval.reranker import Reranker

log = get_logger(__name__)

# Lexical scores are normalised to 0..1 against the best hit in their own
# result set, so the cosine threshold does not apply to them. This is the floor
# for how far below the best lexical match a hit may be and still be a
# candidate for fusion.
_LEXICAL_RELATIVE_FLOOR = 0.35


@dataclass(frozen=True)
class RetrievalTrace:
    """Every intermediate the pipeline produced, for the admin retrieval tester.

    Populated on every call, including production ones, and simply ignored by
    the chat path. That is the point: a debugging view assembled by a *separate*
    code path can only ever show what a second implementation would have done,
    and would drift from the real pipeline exactly when someone needed to trust
    it. Building it inline costs a few list references and no upstream calls.

    Nothing here is ever returned to a visitor — ``internal.py`` is the only
    route that reads it, and that route is behind the shared secret.
    """

    search_query: str
    vector_hits: list[SearchHit] = field(default_factory=list)
    keyword_hits: list[SearchHit] = field(default_factory=list)
    fused: list[FusedHit] = field(default_factory=list)
    # None when no reranker is configured, which is the default. Distinct from
    # an empty list, which would mean a reranker ran and discarded everything.
    reranked: list[FusedHit] | None = None
    selected: list[FusedHit] = field(default_factory=list)
    confidence: Assessment | None = None
    # Per-stage milliseconds. Feeds both the tester and the latency percentiles.
    timings_ms: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class RetrievalResult:
    hits: list[SearchHit]
    # Which path produced these: "hybrid", "vector", "lexical", or "none".
    # Carried through to the response so the client can tell a degraded answer
    # from a full one, and so logs can show how often a fallback is load-bearing.
    strategy: str
    degraded: bool = False
    # Everything the ranking pipeline inferred. Not exposed to visitors — this
    # is for logs, the confidence policy and the admin retrieval tester.
    fused: list[FusedHit] = field(default_factory=list)
    confidence: Assessment | None = None
    context: BuiltContext | None = None
    # The full pipeline trace. Read only by the internal retrieval tester.
    trace: RetrievalTrace | None = None

    @property
    def found(self) -> bool:
        return bool(self.hits)

    @property
    def top_score(self) -> float:
        return self.hits[0].score if self.hits else 0.0




class RetrievalService:
    def __init__(
        self,
        settings: Settings,
        store,  # noqa: ANN001 - QdrantStore, or a fake in tests
        embedder,  # noqa: ANN001 - GeminiEmbedder | HuggingFaceClient
        lexical: LexicalIndex,
        reranker: Reranker | None = None,
    ) -> None:
        self._settings = settings
        self._store = store
        self._embedder = embedder
        self._lexical = lexical
        # Optional so existing callers and tests that predate reranking keep
        # working; None means the fused order stands.
        self._reranker = reranker

    async def retrieve(self, message: str, history: list[dict[str, str]] | None = None) -> RetrievalResult:
        query = build_search_query(message, history)
        if not query:
            return RetrievalResult(hits=[], strategy="none", trace=RetrievalTrace(search_query=""))

        started = time.perf_counter()
        timings: dict[str, float] = {}

        def _lap(name: str, since: float) -> None:
            timings[name] = round((time.perf_counter() - since) * 1000, 2)

        # The vector branch is a network round trip; the keyword branch scores
        # 63 chunks in memory in a few hundred microseconds. There is nothing
        # to gain from overlapping them, so this stays sequential and readable.
        stage = time.perf_counter()
        vector_hits, vector_failed = await self._vector_branch(query)
        _lap("vector", stage)

        stage = time.perf_counter()
        keyword_hits = self._keyword_branch(query)
        _lap("keyword", stage)

        if vector_failed and not keyword_hits:
            log.warning(
                "both retrieval branches failed",
                extra={"event": "retrieval_failed", "source": "none"},
            )
            return RetrievalResult(
                hits=[],
                strategy="none",
                degraded=True,
                trace=RetrievalTrace(search_query=query, timings_ms=timings),
            )

        stage = time.perf_counter()
        fused = reciprocal_rank_fusion(
            vector_hits,
            keyword_hits,
            k=self._settings.rag_rrf_k,
            limit=self._settings.rag_candidates,
        )
        _lap("fusion", stage)
        # Kept before reranking so the tester can show what the reranker changed.
        fused_before_rerank = list(fused)

        reranked: list[FusedHit] | None = None
        if self._reranker is not None and fused:
            stage = time.perf_counter()
            fused = await self._reranker.rerank(query, fused)
            # Only recorded when a reranker genuinely ran. The default is a
            # no-op that returns the list untouched, and reporting that as a
            # rerank stage would show the tester an identical second ranking
            # and imply a reordering step that never happened.
            if getattr(self._reranker, "enabled", False):
                _lap("rerank", stage)
                reranked = list(fused)

        verdict = assess(fused, self._settings)
        timings["total"] = round((time.perf_counter() - started) * 1000, 2)

        def _trace(selected: list[FusedHit]) -> RetrievalTrace:
            return RetrievalTrace(
                search_query=query,
                vector_hits=vector_hits,
                keyword_hits=keyword_hits,
                fused=fused_before_rerank,
                reranked=reranked,
                selected=selected,
                confidence=verdict,
                timings_ms=timings,
            )
        strategy = "hybrid" if (vector_hits and keyword_hits) else ("lexical" if vector_failed else "vector")
        degraded = vector_failed

        if not verdict.answerable:
            log.info(
                "retrieval below confidence, declining",
                extra={
                    "event": "retrieval",
                    "source": strategy,
                    "status": verdict.level.value,
                    "chunks": len(fused),
                    "top_score": round(verdict.top_similarity, 4),
                    "reason": verdict.reason,
                    "duration_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            return RetrievalResult(
                hits=[],
                strategy="none",
                degraded=degraded,
                fused=fused,
                confidence=verdict,
                trace=_trace([]),
            )

        context = build_context(fused, self._settings, limit=self._settings.rag_top_k)
        selected = self._ensure_contact_details(message, context.hits)

        log.info(
            "retrieval complete",
            extra={
                "event": "retrieval",
                "source": strategy,
                "status": verdict.level.value,
                "chunks": len(selected),
                "candidates": len(fused),
                "documents": context.documents,
                "top_score": round(verdict.top_similarity, 4),
                "corroborated": verdict.corroborated,
                "duration_ms": round((time.perf_counter() - started) * 1000),
            },
        )

        return RetrievalResult(
            hits=[hit.hit for hit in selected],
            strategy=strategy,
            degraded=degraded,
            fused=selected,
            confidence=verdict,
            context=context,
            trace=_trace(selected),
        )

    async def _vector_branch(self, query: str) -> tuple[list[SearchHit], bool]:
        """Cosine search. Returns ``(hits, failed)``.

        No score threshold is applied here. Filtering at the branch would hide
        candidates from fusion that the keyword branch independently ranked
        highly, and the confidence policy applies the threshold afterwards with
        more information than this method has.
        """
        try:
            # "query", not "document": Gemini embeds the two asymmetrically, and
            # a question embedded as a passage measurably loses recall.
            vectors = await self._embedder.embed([query], task="query")
            hits = await self._store.search(
                vectors[0],
                limit=self._settings.rag_candidates,
                score_threshold=None,
            )
            return hits, False
        except (EmbeddingError, VectorStoreError) as exc:
            log.warning(
                "vector branch unavailable, continuing with keyword only",
                extra={"event": "retrieval_fallback", "reason": exc.detail or exc.code},
            )
            return [], True

    def _ensure_contact_details(self, message: str, selected: list[FusedHit]) -> list[FusedHit]:
        """Guarantee the contact chunk when the prompt is going to need it.

        For a question about the visitor's own situation the system prompt
        directs the model to point them to the firm — and, if they sound
        distressed, to its phone number. That instruction is unsatisfiable if
        the contact chunk did not rank, and an instruction a model cannot obey
        does not produce silence: it produced "No phone number is present in
        the text. I must not invent one." Adding the passage is what makes the
        rule followable.

        Appended rather than promoted, so it cannot displace the material that
        actually answers the question, and scored 0.0 so it cannot raise
        confidence — the assessment has already been made by this point.
        """
        if not looks_like_personal_matter(message):
            return selected
        if any(hit.hit.category == "contact" for hit in selected):
            return selected

        extra = self._lexical.by_category("contact", limit=1)
        if not extra:
            return selected
        return selected + [FusedHit(hit=extra[0], rrf_score=0.0)]

    def _keyword_branch(self, query: str) -> list[SearchHit]:
        """BM25 over the same approved corpus.

        Trims the long tail: BM25 will happily return a chunk sharing one
        incidental word, and feeding that into fusion lets an irrelevant chunk
        borrow rank from having been "found by two branches".
        """
        hits = self._lexical.search(query, limit=self._settings.rag_candidates)
        return [hit for hit in hits if hit.score >= _LEXICAL_RELATIVE_FLOOR]
