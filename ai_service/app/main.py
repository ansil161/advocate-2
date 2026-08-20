"""FastAPI application factory and process lifecycle.

Everything expensive is built once here and shared: one HTTP connection pool,
one Qdrant connection, one lexical index, one conversation store. Building any
of those per request would turn a fast endpoint into a slow one and would leak
sockets under load.

The service starts even when it is misconfigured. That is a deliberate choice,
not an oversight — an assistant whose token is missing still answers from its
grounded fallbacks and still reports the problem on /health, which is far more
useful than a container that crash-loops and takes the whole widget offline. The
one exception is production with no CORS origins, which is refused at startup:
that configuration cannot serve anyone, so failing loudly is the honest outcome.
"""

from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from qdrant_client import AsyncQdrantClient

from app.api.routes import chat as chat_routes
from app.api.routes import health as health_routes
from app.api.routes import internal as internal_routes
from app.llm.factory import build_embedder, build_providers
from app.llm.providers.huggingface import HuggingFaceClient
from app.clients.qdrant import QdrantStore
from app.clients.redis import connect as connect_redis
from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, get_logger, request_id_var
from app.core.metrics import MetricsRegistry
from app.core.rate_limit import build_rate_limiter
from app.rag.ingestion.corpus import build_chunks
from app.api.schemas.common import ErrorBody, ErrorResponse
from app.services.chat_service import ChatService
from app.conversation.memory import build_conversation_store
from app.rag.retrieval.keyword import LexicalIndex
from app.llm.service import LLMService
from app.rag.retrieval.reranker import build_reranker
from app.rag.retrieval.hybrid import RetrievalService
from app.services.suggestions import SuggestionEngine

log = get_logger(__name__)

API_PREFIX = "/api"

# Rejected before a body is read. The schema caps the message at a few thousand
# characters, so anything approaching this is not a chat message.
MAX_BODY_BYTES = 50 * 1024 * 1024  # 50 MB to allow large document indexing



@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings

    # Disable the default hardcoded knowledge base. The system now relies entirely
    # on documents indexed via the Django admin panel and stored in Qdrant.
    # We pass an empty list of chunks to the in-memory indexes.
    chunks = []
    lexical = LexicalIndex(chunks)

    http_client = httpx.AsyncClient(
        # Bounded so a slow upstream cannot accumulate connections until the
        # process runs out of file descriptors.
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        timeout=httpx.Timeout(settings.llm_timeout_seconds),
    )
    qdrant_client = AsyncQdrantClient(
        url=settings.qdrant_url or None,
        api_key=settings.qdrant_api_key or None,
        timeout=15,
        # The client otherwise makes a version-check call while being
        # constructed, which puts a network round trip — and a warning when the
        # cluster is briefly unreachable — on the startup path. The client and
        # server versions are pinned in requirements.txt, and /health probes the
        # cluster properly.
        check_compatibility=False,
    )

    # Optional. None means every shared-state component falls back to
    # per-process storage; the choice is made once, here.
    redis = await connect_redis(settings)

    hugging_face = HuggingFaceClient(settings, http_client)
    store = QdrantStore(settings, qdrant_client)
    embedder = build_embedder(settings, http_client, hugging_face)
    providers = build_providers(settings, http_client, hugging_face)
    llm = LLMService(settings, providers)

    app.state.lexical_index = lexical
    app.state.vector_store = store
    app.state.embedder = embedder
    app.state.llm = llm
    app.state.redis = redis
    app.state.rate_limiter = build_rate_limiter(settings, redis)
    app.state.metrics = MetricsRegistry()
    app.state.chat_service = ChatService(
        settings=settings,
        # The reranker generates, so it takes the same provider chain the
        # answer does — a rerank is just a cheaper question to the same models.
        retrieval=RetrievalService(settings, store, embedder, lexical, build_reranker(settings, llm)),
        llm=llm,
        conversations=build_conversation_store(settings, redis),
        suggestions=SuggestionEngine(chunks),
        metrics=app.state.metrics,
    )

    log.info(
        "ai service ready",
        extra={
            "event": "startup",
            "chunks": len(chunks),
            "collection": settings.qdrant_collection,
            "embedder": embedder.name if hasattr(embedder, "name") else settings.embedding_provider,
            "providers": ",".join(p.name for p in providers) or "none",
            "status": settings.environment,
            "state": app.state.rate_limiter.backend,
        },
    )
    # Two independent capabilities, two independent warnings. Losing embeddings
    # costs vector search; losing generation costs composed answers. Reporting
    # them together would hide which one is actually missing.
    if not settings.embeddings_configured:
        log.warning(
            "embedding provider has no credentials — no vector search, and the indexer cannot run",
            extra={"event": "startup", "reason": "embeddings_unconfigured"},
        )
    if not settings.generation_configured:
        log.warning(
            "no generation provider is configured — answers will quote sources verbatim",
            extra={"event": "startup", "reason": "no_generation_provider"},
        )

    try:
        yield
    finally:
        await http_client.aclose()
        await qdrant_client.close()
        if redis is not None:
            await redis.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level, json_output=settings.is_production)

    if settings.is_production and not settings.cors_allow_origins:
        raise RuntimeError(
            "CORS_ALLOW_ORIGINS must list the site's origin in production. "
            "A browser-facing endpoint with no allowed origin can serve no one."
        )

    app = FastAPI(
        title="SLA Advocates — AI Assistant",
        version="1.0.0",
        # The schema explorer describes the service's shape in detail. Useful
        # while building, not something to publish from a firm's origin.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        # Exact origins only, never a wildcard: this endpoint spends money per
        # call, so it answers the firm's own site and nothing else.
        allow_origins=settings.cors_allow_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
        max_age=3600,
    )

    @app.middleware("http")
    async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
        """Tag each request, cap its body, and time it.

        The body cap is here rather than in the schema because it has to apply
        before the payload is parsed — a 50MB JSON document should be refused,
        not deserialised and then found to be too long.
        """
        token = request_id_var.set(uuid.uuid4().hex[:12])
        started = time.perf_counter()
        try:
            declared = request.headers.get("content-length")
            # Cap public chat questions at 64KB, and internal admin document indexing at 50MB
            max_bytes = 50 * 1024 * 1024 if request.url.path.startswith("/internal") else 64 * 1024
            if declared and declared.isdigit() and int(declared) > max_bytes:
                return JSONResponse(
                    status_code=413,
                    content=ErrorResponse(
                        error=ErrorBody(code="payload_too_large", message="Document or message payload is too large.")
                    ).model_dump(),
                )


            response = await call_next(request)
            # Echoed so a visitor reporting a problem can be matched to a log
            # line without anyone needing to have recorded what they asked.
            response.headers["X-Request-ID"] = request_id_var.get()
            if request.url.path.startswith(API_PREFIX):
                log.info(
                    "request complete",
                    extra={
                        "event": "http",
                        "status": response.status_code,
                        "duration_ms": round((time.perf_counter() - started) * 1000),
                    },
                )
            return response
        finally:
            request_id_var.reset(token)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Answer a malformed request without describing the schema.

        FastAPI's default handler returns the field path, the failing value and
        the rule that rejected it. That is a good developer experience and a
        poor security posture on a public endpoint, and it would echo the
        visitor's own text back into a response body.
        """
        log.info("request rejected by validation", extra={"event": "validation_rejected"})
        return JSONResponse(
            status_code=422,
            content=ErrorResponse(
                error=ErrorBody(
                    code="invalid_request",
                    message="That message couldn't be sent. Please try rephrasing it.",
                )
            ).model_dump(),
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        """The last line between an unexpected bug and a stack trace on screen."""
        log.exception("unhandled error", extra={"event": "unhandled"})
        return JSONResponse(
            status_code=500,
            content=ErrorResponse(
                error=ErrorBody(
                    code="internal_error",
                    message="Something went wrong at our end. Please try again in a moment.",
                )
            ).model_dump(),
        )

    app.include_router(health_routes.router, prefix=API_PREFIX)
    app.include_router(chat_routes.router, prefix=API_PREFIX)
    # Deliberately NOT under API_PREFIX and not on the CORS allow-list:
    # this is a server-to-server surface, not a browser one.
    app.include_router(internal_routes.router, prefix="/internal")
    return app


app = create_app()
