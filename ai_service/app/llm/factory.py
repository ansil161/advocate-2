"""Turning configuration into concrete clients.

Separate from ``main.py`` on purpose. The indexer needs exactly the same
embedder the running service uses — that is not a nicety, it is the property
that keeps queries and documents in one vector space — and importing it from
``main`` would build a whole FastAPI application as a side effect just to reach
one function. Both callers import from here instead.
"""

from __future__ import annotations

import httpx

from app.core.config import Settings
from app.core.logging import get_logger
from app.llm.base import ChatProvider
from app.llm.providers.gemini import GeminiClient
from app.rag.ingestion.embedder import GeminiEmbedder
from app.llm.providers.huggingface import HuggingFaceClient, HuggingFaceProvider
from app.llm.providers.langchain import LangChainProvider
from app.llm.providers.openai_compatible import OpenAICompatibleClient

log = get_logger(__name__)


def build_embedder(
    settings: Settings,
    http_client: httpx.AsyncClient,
    hugging_face: HuggingFaceClient,
) -> GeminiEmbedder | HuggingFaceClient:
    """Pick the embedding backend named by ``EMBEDDING_PROVIDER``.

    Whatever this returns must be the same model that indexed the collection.
    Queries embedded by a different model land in a different vector space and
    every score becomes meaningless — with nothing failing outwardly, which is
    what makes it worth centralising in one function.
    """
    if settings.uses_gemini_embeddings:
        return GeminiEmbedder(settings, http_client)
    return hugging_face


def build_providers(
    settings: Settings,
    http_client: httpx.AsyncClient,
    hugging_face: HuggingFaceClient,
) -> list[ChatProvider]:
    """Resolve ``LLM_PROVIDER_ORDER`` into a concrete failover chain.

    Each vendor contributes its own primary-then-fallback models, so the
    default order expands to gemini-3.5-flash → gemini-3.5-flash-lite →
    llama-3.3-70b → llama-3.1-8b → the two Hugging Face models. An unknown name
    is logged and skipped rather than raised: a typo in one entry should cost
    that provider, not the whole service.
    """
    providers: list[ChatProvider] = []
    for name in settings.llm_provider_order:
        key = name.strip().lower()
        if key == "gemini":
            providers.extend(
                GeminiClient(settings, http_client, model) for model in settings.gemini_models
            )
        elif key == "groq":
            providers.extend(
                OpenAICompatibleClient(
                    settings,
                    http_client,
                    vendor="groq",
                    base_url=settings.groq_api_base,
                    api_key=settings.groq_api_key,
                    model=model,
                )
                for model in settings.groq_models
            )
        elif key in {"huggingface", "hf"}:
            providers.extend(
                HuggingFaceProvider(hugging_face, settings, model) for model in settings.chat_models
            )
        elif key == "langchain":
            # Constructing this is cheap; the expensive LangChain import happens
            # inside on first generate(), so listing it costs nothing until it
            # is actually reached.
            providers.append(LangChainProvider(settings))
        elif key:
            log.warning(
                "unknown generation provider in LLM_PROVIDER_ORDER, skipping",
                extra={"event": "startup", "provider": key},
            )
    return providers
