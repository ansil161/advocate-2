"""Health and readiness.

Reports on the two upstreams this service cannot work without, because both can
be misconfigured in ways that still let the process start: a missing token
produces an assistant that answers every question from its fallbacks, and a
collection that was never indexed produces one that politely knows nothing. Both
look like a working deployment from the outside.

The vector store is probed live; a cached "it was fine at startup" would be the
one thing this endpoint must not say.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.exceptions import VectorStoreError
from app.core.logging import get_logger
from app.api.schemas.common import HealthResponse, ProviderHealth

log = get_logger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    state = request.app.state
    settings = state.settings

    if not settings.vector_store_configured:
        vector_store = "not configured"
    else:
        try:
            # Existence is checked before counting, because counting a missing
            # collection fails the same way an unreachable cluster does — and
            # "the knowledge base was never indexed" and "the cluster is down"
            # need very different responses from whoever is reading this.
            if not await state.vector_store.exists():
                vector_store = "collection missing — run scripts/index_knowledge.py"
            else:
                count = await state.vector_store.count()
                vector_store = f"ok ({count} points)" if count else "empty — run scripts/index_knowledge.py"
        except VectorStoreError as exc:
            # The reason is logged, not returned: this endpoint is reachable
            # without credentials and should not describe the cluster's state
            # to whoever asks.
            log.error("health check could not reach qdrant", extra={"event": "health", "reason": exc.detail})
            vector_store = "unreachable"

    embeddings = "ok" if settings.embeddings_configured else "not configured — set HF_TOKEN"

    # Which backend holds rate-limit counters, conversation memory and the
    # metrics window. Reported rather than inferred: "in-process" means each
    # worker enforces its own limit, and an operator has no other way to see
    # that from outside.
    shared_state = getattr(state, "rate_limiter", None)
    state_backend = getattr(shared_state, "backend", "in-process")

    # Reported from the live breakers rather than from configuration, so a
    # provider that is credentialed but currently tripped is visible as such.
    provider_health = [ProviderHealth(**entry) for entry in state.llm.health()]  # type: ignore[arg-type]
    usable = [p for p in provider_health if p.configured and p.state != "open"]
    if not any(p.configured for p in provider_health):
        llm = "not configured — set GEMINI_API_KEY or HF_TOKEN"
    elif not usable:
        llm = "all providers unavailable"
    else:
        llm = f"ok ({usable[0].provider})"

    # "degraded" rather than "error": the assistant genuinely still serves
    # requests in this state, and a load balancer should not pull it out of
    # rotation for a condition its fallbacks are designed to absorb.
    healthy = vector_store.startswith("ok") and llm.startswith("ok") and embeddings == "ok"

    return HealthResponse(
        status="ok" if healthy else "degraded",
        knowledge_chunks=len(state.lexical_index),
        vector_store=vector_store,
        llm=llm,
        embeddings=embeddings,
        shared_state=state_backend,
        providers=provider_health,
    )
