"""Assembling a retrieval trace for the admin tester.

Presentation for a diagnostic, kept out of the route that serves it. The route
was importing ``rag.retrieval.rrf`` and ``prompts.rag`` purely to build a
response body — an api-layer module reaching two layers down to do work that is
not routing.

Nothing here re-runs or re-derives anything. It calls the same
``RetrievalService`` the chat endpoint calls and reads the trace that call
already produced, so the tester shows what production did rather than what a
second implementation would have done.
"""

from __future__ import annotations

from app.core.config import Settings
from app.prompts.rag import build_context_block
from app.rag.retrieval.rrf import FusedHit


def _hit_row(fused: FusedHit) -> dict:
    """One ranked chunk, with every signal the pipeline attached to it."""
    hit = fused.hit
    return {
        "document": hit.document,
        "section": hit.section,
        "category": hit.category,
        "url": hit.url,
        # Present only on admin-authored chunks; the site corpus carries neither.
        "document_id": getattr(hit, "document_id", "") or "",
        "version": getattr(hit, "version", None),
        "vector_score": fused.vector_score,
        "keyword_score": fused.keyword_score,
        "vector_rank": fused.vector_rank,
        "keyword_rank": fused.keyword_rank,
        "rrf_score": fused.rrf_score,
        "rerank_score": fused.rerank_score,
        "branches": fused.branches,
        "text": hit.text,
    }


def _plain_row(hit) -> dict:  # noqa: ANN001 - SearchHit
    """A pre-fusion branch result, which has only its own score."""
    return {
        "document": hit.document,
        "section": hit.section,
        "category": hit.category,
        "score": round(hit.score, 6),
        "text": hit.text[:400],
    }


async def trace_retrieval(
    *,
    question: str,
    history: list[str],
    retrieval,  # noqa: ANN001 - RetrievalService
    settings: Settings,
) -> dict:
    """Run one question through the pipeline and render everything it produced."""
    turns = [{"role": "user", "content": t} for t in history if t.strip()]
    result = await retrieval.retrieve(question, turns)

    trace = result.trace
    confidence = result.confidence

    return {
        "question": question,
        # What was actually embedded, which differs from the question whenever
        # conversation history was folded in. Showing both is the point: it is
        # the only way to see why a follow-up resolved the way it did.
        "search_query": trace.search_query if trace else question,
        "history_used": len(turns),
        "strategy": result.strategy,
        "degraded": result.degraded,
        "answerable": result.found,
        "confidence": (
            {
                "level": confidence.level.value,
                "top_similarity": round(confidence.top_similarity, 4),
                "supporting": confidence.supporting,
                "documents": confidence.documents,
                "corroborated": confidence.corroborated,
                "reason": confidence.reason,
            }
            if confidence
            else None
        ),
        "thresholds": {
            "score_threshold": settings.rag_score_threshold,
            "confidence_high": settings.rag_confidence_high,
            "support_floor": settings.rag_support_floor,
            "top_k": settings.rag_top_k,
            "candidates": settings.rag_candidates,
            "rrf_k": settings.rag_rrf_k,
            "reranker": settings.rag_reranker,
        },
        "vector_results": [_plain_row(h) for h in (trace.vector_hits if trace else [])],
        "keyword_results": [_plain_row(h) for h in (trace.keyword_hits if trace else [])],
        "rrf_results": [_hit_row(f) for f in (trace.fused if trace else [])],
        # None rather than [] when no reranker is configured, so the UI can say
        # "not enabled" instead of "discarded everything".
        "reranked_results": (
            [_hit_row(f) for f in trace.reranked] if trace and trace.reranked is not None else None
        ),
        "selected": [_hit_row(f) for f in (trace.selected if trace else [])],
        # Built with the same function the prompt builder uses, so this is the
        # exact block the model would receive — not a rendering of it.
        "context": build_context_block(result.hits, settings) if result.found else "",
        # What the context builder discarded on the way to that block, which is
        # the only place a "why is that chunk missing" question gets an answer.
        "context_budget": (
            {
                "used_chars": result.context.used_chars,
                "dropped_duplicate": result.context.dropped_duplicate,
                "dropped_budget": result.context.dropped_budget,
                "dropped_document_cap": result.context.dropped_document_cap,
                "max_chars": settings.rag_max_context_chars,
            }
            if result.context
            else None
        ),
        "timings_ms": trace.timings_ms if trace else {},
    }
