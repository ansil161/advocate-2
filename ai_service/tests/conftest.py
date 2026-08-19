"""Shared fixtures.

The suite never calls Hugging Face or Qdrant. Both are replaced with fakes that
can be told to fail on demand, because the behaviour most worth testing in this
service is what happens when they *do* — the fallback chain is the feature, and
a suite that only exercises the happy path would not cover it.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.exceptions import EmbeddingError, GenerationError, VectorStoreError
from app.core.rate_limit import RateLimiter
from app.core.types import SearchHit
from app.rag.ingestion.corpus import build_chunks
from app.main import create_app
from app.services.chat_service import ChatService
from app.conversation.memory import ConversationStore
from app.rag.retrieval.keyword import LexicalIndex
from app.llm.service import LLMService
from app.rag.retrieval.hybrid import RetrievalService
from app.services.suggestions import SuggestionEngine


@pytest.fixture(scope="session")
def chunks():
    """The real corpus. Tests assert against the firm's actual content."""
    return build_chunks()


@pytest.fixture
def settings() -> Settings:
    # _env_file=None is load-bearing, not tidiness. Constructing Settings()
    # directly still reads ai/.env for every field not passed here, so without
    # it the suite silently inherits the developer's real configuration — and a
    # test asserting behaviour for an *unset* value passes or fails depending on
    # whose machine it runs on. This pins every field to what the test says.
    return Settings(
        _env_file=None,
        hf_token="test-token",
        # https so the client does not warn about sending a key over plaintext;
        # nothing in the suite actually connects to it.
        qdrant_url="https://localhost:6333",
        qdrant_api_key="test-key",
        cors_allow_origins=["http://localhost:5173"],
        rate_limit_per_minute=5,
        rate_limit_per_day=50,
        chat_max_message_chars=1000,
        chat_history_turns=3,
        environment="test",
        # Pinned rather than inherited. _env_file=None blocks ai/.env, but a
        # real exported variable still outranks a field default — so anything a
        # test asserts against has to be stated here, or the suite's verdict
        # depends on the developer's shell.
        internal_api_key="",
        rag_top_k=5,
        rag_candidates=25,
        rag_rrf_k=60,
        rag_reranker="none",
        rag_score_threshold=0.58,
        rag_confidence_high=0.70,
        rag_support_floor=0.62,
        rag_max_chunks_per_document=2,
        rag_max_context_chars=6000,
        embedding_provider="huggingface",
    )


class FakeEmbedder:
    """Stands in for the embedding client.

    ``fail`` flips it into the state the retrieval fallback exists for.
    """

    def __init__(self, dim: int = 384) -> None:
        self.dim = dim
        self.fail = False
        self.calls: list[list[str]] = []
        # Recorded so a test can assert that queries are embedded as queries.
        # Getting this backwards costs recall silently, so it is worth pinning.
        self.tasks: list[str] = []

    async def embed(self, texts: list[str], *, task: str = "document") -> list[list[float]]:
        if self.fail:
            raise EmbeddingError("forced failure")
        self.calls.append(texts)
        self.tasks.append(task)
        return [[0.1] * self.dim for _ in texts]

    async def chat(self, model: str, messages: list[dict[str, str]]) -> str:
        raise GenerationError("FakeEmbedder does not generate")


class FakeStore:
    """Stands in for Qdrant, returning whatever the test puts in ``hits``."""

    def __init__(self) -> None:
        self.hits: list[SearchHit] = []
        self.fail = False
        self.collection = "test_collection"

    async def search(self, vector, *, limit, score_threshold=None, category=None):  # noqa: ANN001
        if self.fail:
            raise VectorStoreError("forced failure")
        hits = self.hits[:limit]
        if score_threshold is not None:
            hits = [h for h in hits if h.score >= score_threshold]
        return hits

    async def count(self) -> int:
        return len(self.hits)

    async def exists(self) -> bool:
        return True


class FakeLLM:
    """Stands in for the chat client. ``fail`` triggers the quote fallback."""

    def __init__(self, reply: str = "The firm handles twelve areas of law.") -> None:
        self.reply = reply
        self.fail = False
        self.seen: list[list[dict[str, str]]] = []

    async def generate(self, messages: list[dict[str, str]]) -> tuple[str, str]:
        self.seen.append(messages)
        if self.fail:
            raise GenerationError("forced failure")
        return self.reply, "fake-model"


def make_hit(
    text: str = "SLA Advocates practises across 12 areas of law.",
    *,
    score: float = 0.82,
    category: str = "practice-area",
    document: str = "Practice Areas",
    section: str = "Index",
    url: str = "/practice",
) -> SearchHit:
    return SearchHit(
        text=text,
        title="The areas of law SLA Advocates handles",
        category=category,
        document=document,
        section=section,
        url=url,
        updated_at="2026-08-14",
        score=score,
    )


@pytest.fixture
def parts(settings, chunks):
    """A chat service wired to fakes, with the fakes handed back for control."""
    embedder = FakeEmbedder(dim=settings.hf_embedding_dim)
    store = FakeStore()
    llm = FakeLLM()
    lexical = LexicalIndex(chunks)
    conversations = ConversationStore(settings)

    service = ChatService(
        settings=settings,
        retrieval=RetrievalService(settings, store, embedder, lexical),
        llm=llm,
        conversations=conversations,
        suggestions=SuggestionEngine(chunks),
    )
    return {
        "service": service,
        "embedder": embedder,
        "store": store,
        "llm": llm,
        "lexical": lexical,
        "conversations": conversations,
        "settings": settings,
    }


@pytest.fixture
def client(settings, parts):
    """A TestClient whose app state is replaced with the fake-backed service.

    The real lifespan still runs — it is what builds the lexical index and
    proves the app can start — and its wiring is then swapped for the fakes.
    """
    app = create_app(settings)
    with TestClient(app) as test_client:
        app.state.chat_service = parts["service"]
        app.state.vector_store = parts["store"]
        app.state.rate_limiter = RateLimiter(settings)
        yield test_client
