"""Internal indexing API — the only way admin content reaches Qdrant.

Django owns the authoritative document state; this service owns the vectors.
Rather than give Django a second Qdrant client and a second embedding pipeline
— two copies of the chunking rules, two places for the dimension to drift —
Django calls these endpoints and this service does what it already knows how to
do. One integration, one embedder, one set of chunk ids.

**Not public.** Mounted under ``/internal`` and gated on a shared secret that
has nothing to do with visitor sessions. It is not on the CORS allow-list, so a
browser cannot reach it regardless; the secret is what stops anything else on
the network from rewriting the firm's knowledge base.

**Delete-then-write, in that order, verified.** Publishing a new version first
removes every vector carrying the document's id, then writes the new chunks.
Doing it the other way round leaves the old version's chunks alive alongside
the new ones whenever the new version splits into fewer pieces — and the stale
chunk still retrieves, so the assistant answers from content the firm has
already replaced. The count is read back afterwards and returned, so Django
records what actually landed rather than what was intended.
"""

from __future__ import annotations

import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from app.core.config import Settings
from app.core.exceptions import ChatError
from app.core.logging import get_logger
from app.core.security import (
    InternalAuthFailed,
    InternalAuthUnavailable,
    verify_internal_key,
)
from app.evaluation import MODE_RETRIEVAL, run_evaluation
from app.services.admin_indexing import (
    EmptyDocument,
    publish_document,
    unpublish_document,
)
from app.services.diagnostics import trace_retrieval
from app.api.deps import get_settings_dep

log = get_logger(__name__)

router = APIRouter(tags=["internal"])


async def require_internal_key(
    request: Request,
    settings: Settings = Depends(get_settings_dep),
    x_internal_key: str = Header(default=""),
) -> None:
    """Shared-secret gate.

    The rule itself lives in ``app.core.security``; all this does is turn its
    exceptions into status codes, which is the only part that belongs at the
    HTTP boundary. Same codes as before: 503 when no secret is configured,
    401 when one is supplied and wrong.
    """
    try:
        verify_internal_key(x_internal_key, settings, path=request.url.path)
    except InternalAuthUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InternalAuthFailed as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


class IndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    document_id: str = Field(min_length=1, max_length=64)
    version: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=200_000)
    category: str = Field(min_length=1, max_length=32)
    slug: str = Field(min_length=1, max_length=220)
    source_url: str = Field(default="", max_length=500)
    updated_at: str = Field(default="", max_length=40)


class IndexResponse(BaseModel):
    document_id: str
    version: int
    chunks_indexed: int
    duration_ms: int


class DeleteResponse(BaseModel):
    document_id: str
    remaining: int


@router.post("/knowledge/index", response_model=IndexResponse, dependencies=[Depends(require_internal_key)])
async def index_document(payload: IndexRequest, request: Request) -> IndexResponse:
    """Chunk, embed and publish one document version, replacing any previous one.

    The publish sequence — and the ordering guarantees that make it safe — lives
    in ``app.services.admin_indexing``. This handler validates, delegates, and
    translates failures into status codes.
    """
    state = request.app.state
    settings: Settings = state.settings
    started = time.perf_counter()

    if not settings.embeddings_configured:
        raise HTTPException(status_code=503, detail="embedding provider is not configured")

    try:
        outcome = await publish_document(
            document_id=payload.document_id,
            version=payload.version,
            title=payload.title,
            content=payload.content,
            category=payload.category,
            slug=payload.slug,
            source_url=payload.source_url,
            updated_at=payload.updated_at,
            store=state.vector_store,
            embedder=state.embedder,
            dim=settings.embedding_dim,
        )
    except EmptyDocument as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ChatError as exc:
        log.error(
            "admin document indexing failed",
            extra={
                "event": "admin_index_failed",
                "document": payload.document_id,
                "reason": exc.detail,
            },
        )
        raise HTTPException(status_code=502, detail=exc.detail or "indexing failed") from exc

    return IndexResponse(
        document_id=outcome.document_id,
        version=outcome.version,
        chunks_indexed=outcome.chunks_indexed,
        duration_ms=round((time.perf_counter() - started) * 1000),
    )


@router.delete(
    "/knowledge/{document_id}", response_model=DeleteResponse, dependencies=[Depends(require_internal_key)]
)
async def unindex_document(document_id: str, request: Request) -> DeleteResponse:
    """Remove a document's vectors — how unpublishing takes effect."""
    remaining = 0
    try:
        remaining = await unpublish_document(document_id, store=request.app.state.vector_store)
    except Exception as exc:
        log.warning(f"unindex_document caught exception for document {document_id}: {exc}")
    return DeleteResponse(document_id=document_id, remaining=remaining)




@router.get(
    "/knowledge/{document_id}/chunks", dependencies=[Depends(require_internal_key)]
)
async def get_document_chunks(document_id: str, request: Request) -> dict:
    """Return the raw chunks for a specific document."""
    try:
        chunks = await request.app.state.vector_store.get_chunks_by_document(document_id)
        return {"document_id": document_id, "chunks": chunks}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# ── Retrieval tester ─────────────────────────────────────────────────────────
#
# Why this lives behind the internal key rather than beside /api/chat: it
# returns raw chunk text, similarity scores, the assembled prompt context and
# the confidence reasoning. All of that is exactly what an operator needs and
# exactly what a public endpoint must never disclose — the scores alone would
# let someone map the corpus and tune questions against the threshold.


class RetrievalDebugRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=1000)
    # Prior user turns, so an admin can reproduce a follow-up exactly as the
    # visitor experienced it rather than in isolation.
    history: list[str] = Field(default_factory=list, max_length=10)


@router.post("/retrieval/debug", dependencies=[Depends(require_internal_key)])
async def retrieval_debug(payload: RetrievalDebugRequest, request: Request) -> dict:
    """Trace one question through the live retrieval pipeline.

    The route validates, authorises and hands off. Assembling the trace is the
    diagnostics service's job — keeping it here meant a route importing the
    fusion and prompt modules to build a response body.
    """
    state = request.app.state
    try:
        return await trace_retrieval(
            question=payload.question,
            history=payload.history,
            retrieval=state.chat_service.retrieval,
            settings=state.settings,
        )
    except ChatError as exc:
        raise HTTPException(status_code=502, detail=exc.detail or "retrieval failed") from exc


# ── Evaluation ───────────────────────────────────────────────────────────────


class EvaluationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # "retrieval" (default, no generation calls) or "full".
    mode: str = MODE_RETRIEVAL
    category: str = ""


@router.post("/evaluation/run", dependencies=[Depends(require_internal_key)])
async def evaluation_run(payload: EvaluationRequest, request: Request) -> dict:
    """Run the evaluation set against this deployment and return a graded report."""
    state = request.app.state
    report = await run_evaluation(
        chat_service=state.chat_service,
        retrieval_service=state.chat_service.retrieval,
        mode=payload.mode,
        category=payload.category,
    )
    from dataclasses import asdict as _asdict

    return _asdict(report)


@router.get("/evaluation/cases", dependencies=[Depends(require_internal_key)])
async def evaluation_cases() -> dict:
    """The question set itself, so the panel can show what will be run."""
    from app.evaluation import CASES, CATEGORIES

    return {
        "total": len(CASES),
        "categories": list(CATEGORIES),
        "cases": [
            {
                "id": case.id,
                "question": case.question,
                "category": case.category,
                "expect": case.expect.value,
                "history": list(case.history),
                "note": case.note,
            }
            for case in CASES
        ],
    }


# ── Metrics ──────────────────────────────────────────────────────────────────


@router.get("/metrics", dependencies=[Depends(require_internal_key)])
async def metrics(request: Request) -> dict:
    """Latency percentiles and turn counts for the admin dashboard."""
    return request.app.state.metrics.snapshot()

