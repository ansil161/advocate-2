"""Gemini embeddings, with the two details that decide whether retrieval works.

**Task types.** Gemini embeds asymmetrically: a passage indexed as
``RETRIEVAL_DOCUMENT`` and a question embedded as ``RETRIEVAL_QUERY`` land
closer together than the same pair embedded identically. A question is short
and interrogative, a passage is long and declarative, and telling the model
which is which is what closes that gap. Getting this backwards — or leaving it
unset on both sides — quietly costs recall in a way no error surfaces, so the
task is a required argument here rather than an optional flag.

**Normalisation.** At the full 3072 dimensions Gemini returns unit vectors. At
any smaller ``outputDimensionality`` it does not — the truncated vector is
returned unscaled, measured here at norm 0.589 for 768 dimensions. Qdrant's
cosine distance normalises on upsert, so this would mostly work by accident;
it is done explicitly anyway so that a score computed anywhere else in the
service means the same thing as a score computed by the store.

Why 768 rather than 3072: four times less memory per point at a similarity
quality that is indistinguishable on a corpus this size, and the collection is
being created from scratch, so there is no migration to weigh against it.
"""

from __future__ import annotations

import math
from typing import Any

import httpx

from app.core.config import Settings
from app.core.exceptions import EmbeddingError
from app.core.logging import get_logger
from app.clients.http import post_json

log = get_logger(__name__)

# What the two sides of a retrieval pair must be embedded as. Anything else is
# a caller bug, so the mapping is exhaustive and unknown values raise.
_TASK_TYPES = {
    "document": "RETRIEVAL_DOCUMENT",
    "query": "RETRIEVAL_QUERY",
}

# Gemini rejects oversized batches; this is well inside the limit and keeps a
# cold start from timing out on the first call.
MAX_BATCH = 16


def normalise(vector: list[float]) -> list[float]:
    """Scale to unit length, leaving an all-zero vector alone.

    A zero vector has no direction to preserve and dividing by its norm would
    be a division by zero — it is passed through so the failure surfaces as a
    bad search result rather than as an arithmetic error mid-index.
    """
    norm = math.sqrt(sum(component * component for component in vector))
    if norm == 0.0:
        return vector
    return [component / norm for component in vector]


class GeminiEmbedder:
    """Embeddings from Gemini, batched and unit-normalised."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._client = client

    @property
    def name(self) -> str:
        return f"gemini:{self._settings.gemini_embedding_model}"

    @property
    def configured(self) -> bool:
        return self._settings.gemini_configured

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "x-goog-api-key": self._settings.gemini_api_key,
            "Content-Type": "application/json",
        }

    def _request(self, text: str, task: str) -> dict[str, Any]:
        model = self._settings.gemini_embedding_model
        return {
            "model": f"models/{model}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": self._settings.gemini_embedding_dim,
            "taskType": task,
        }

    async def embed(self, texts: list[str], *, task: str = "document") -> list[list[float]]:
        """Embed in input order. ``task`` must be "document" or "query"."""
        if not texts:
            return []
        if not self.configured:
            raise EmbeddingError("GEMINI_API_KEY is not configured")

        task_type = _TASK_TYPES.get(task)
        if task_type is None:
            raise EmbeddingError(f"unknown embedding task {task!r}")

        base = self._settings.gemini_api_base.rstrip("/")
        model = self._settings.gemini_embedding_model
        url = f"{base}/models/{model}:batchEmbedContents"

        vectors: list[list[float]] = []
        for start in range(0, len(texts), MAX_BATCH):
            batch = texts[start : start + MAX_BATCH]
            data = await post_json(
                self._client,
                url,
                {"requests": [self._request(text, task_type) for text in batch]},
                headers=self._headers,
                timeout=self._settings.embedding_timeout_seconds,
                failure=EmbeddingError,
                provider=self.name,
            )
            vectors.extend(_as_vectors(data, len(batch)))

        expected = self._settings.gemini_embedding_dim
        for vector in vectors:
            if len(vector) != expected:
                # Almost always a mismatch between the configured dimension and
                # the collection's fixed width. Worth failing loudly: vectors of
                # the wrong size are rejected by Qdrant at index time and
                # silently mis-rank at query time.
                raise EmbeddingError(
                    f"model returned {len(vector)}-dim vectors, expected {expected}"
                )
        return [normalise(vector) for vector in vectors]


def _as_vectors(data: Any, expected_count: int) -> list[list[float]]:
    if not isinstance(data, dict):
        raise EmbeddingError("unexpected embedding response shape")

    entries = data.get("embeddings")
    if not isinstance(entries, list):
        raise EmbeddingError("embedding response carried no 'embeddings' array")
    if len(entries) != expected_count:
        raise EmbeddingError(f"expected {expected_count} vectors, received {len(entries)}")

    vectors: list[list[float]] = []
    for entry in entries:
        values = (entry or {}).get("values")
        if not isinstance(values, list) or not values:
            raise EmbeddingError("embedding entry carried no values")
        vectors.append([float(v) for v in values])
    return vectors
