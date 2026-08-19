"""Hugging Face Inference API client — embeddings and chat completions.

One token covers both halves of the pipeline, which is why this service needs
no second provider:

* **Embeddings** go to the ``feature-extraction`` pipeline, which for a
  sentence-transformers model returns one pooled vector per input.
* **Generation** goes to the OpenAI-compatible chat-completions router, which
  fronts several inference providers behind a single endpoint.

The retry behaviour here is not boilerplate. Hugging Face's serverless
endpoints cold-start: the first call to a model that has been idle answers
``503`` with a ``estimated_time`` while weights are loaded. Treating that as a
hard failure would make the assistant look broken every time it had been quiet
for a while, so a 503 is retried, and only a persistent one is raised.
"""

from __future__ import annotations

from typing import Any, AsyncIterator

import httpx

from app.core.config import Settings
from app.core.exceptions import EmbeddingError, GenerationError
from app.core.logging import get_logger
from app.clients.http import post_json

log = get_logger(__name__)


class HuggingFaceClient:
    """Thin async wrapper. One instance per process, sharing one connection pool."""

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        self._settings = settings
        self._client = client

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._settings.hf_token}",
            "Content-Type": "application/json",
        }

    async def _post(
        self,
        url: str,
        payload: dict[str, Any],
        *,
        timeout: float,
        failure: type[Exception],
    ) -> Any:
        return await post_json(
            self._client,
            url,
            payload,
            headers=self._headers,
            timeout=timeout,
            failure=failure,
            provider="huggingface",
        )

    # ── embeddings ───────────────────────────────────────────────────────────

    async def embed(self, texts: list[str], *, task: str = "document") -> list[list[float]]:
        """Embed one or more strings, preserving input order.

        ``task`` is accepted and ignored: sentence-transformers models embed
        queries and passages symmetrically, so there is nothing to distinguish.
        It exists so this client and the Gemini embedder are interchangeable
        without the callers branching on which one they hold.
        """
        del task
        if not texts:
            return []
        if not self._settings.llm_configured:
            raise EmbeddingError("HF_TOKEN is not configured")

        model = self._settings.hf_embedding_model
        url = f"{self._settings.hf_api_base}/hf-inference/models/{model}/pipeline/feature-extraction"
        data = await self._post(
            url,
            # wait_for_model turns a cold start from an error into a slow
            # success, which is the right trade for a single user-facing call.
            {"inputs": texts, "options": {"wait_for_model": True}},
            timeout=self._settings.embedding_timeout_seconds,
            failure=EmbeddingError,
        )

        vectors = _as_vectors(data)
        if len(vectors) != len(texts):
            raise EmbeddingError(f"expected {len(texts)} vectors, received {len(vectors)}")

        expected = self._settings.hf_embedding_dim
        for vector in vectors:
            if len(vector) != expected:
                # Almost always a model/dimension mismatch in .env, and worth
                # failing loudly: vectors of the wrong width would be rejected
                # by Qdrant at index time or silently mis-rank at query time.
                raise EmbeddingError(
                    f"model returned {len(vector)}-dim vectors, HF_EMBEDDING_DIM is {expected}"
                )
        return vectors

    # ── generation ───────────────────────────────────────────────────────────

    async def chat(self, model: str, messages: list[dict[str, str]]) -> str:
        """Run one chat completion and return its text."""
        if not self._settings.llm_configured:
            raise GenerationError("HF_TOKEN is not configured")

        url = f"{self._settings.hf_api_base}/v1/chat/completions"
        data = await self._post(
            url,
            {
                "model": model,
                "messages": messages,
                "max_tokens": self._settings.llm_max_output_tokens,
                # Low but not zero. This assistant restates sourced material in
                # a professional register; it is not being asked to be creative,
                # and a higher setting mostly buys embellishment.
                "temperature": 0.2,
                "stream": False,
            },
            timeout=self._settings.llm_timeout_seconds,
            failure=GenerationError,
        )

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise GenerationError("unexpected chat completion shape") from None

        text = (content or "").strip()
        if not text:
            raise GenerationError("model returned an empty completion")
        return text


class HuggingFaceProvider:
    """One Hugging Face chat model, behind the ``ChatProvider`` contract.

    Binds a model to the shared client so that ``LLMService`` can treat "Llama
    on HF" and "Gemini Flash" as two interchangeable entries in one failover
    list, rather than as two code paths.
    """

    def __init__(self, client: HuggingFaceClient, settings: Settings, model: str) -> None:
        self._client = client
        self._settings = settings
        self._model = model

    @property
    def name(self) -> str:
        return f"huggingface:{self._model}"

    @property
    def configured(self) -> bool:
        return self._settings.llm_configured

    async def generate(self, messages: list[dict[str, str]]) -> str:
        return await self._client.chat(self._model, messages)

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Emit the completion as a single fragment.

        The router does support SSE, but this provider is the *fallback* — it is
        reached only when Gemini is already failing, and at that point delivering
        a correct answer matters more than delivering it incrementally. Keeping
        it non-streaming here means one fewer upstream streaming format to get
        right for a path that should be rare.
        """
        yield await self.generate(messages)


def _as_vectors(data: Any) -> list[list[float]]:
    """Normalise the feature-extraction response to one vector per input.

    A sentence-transformers model returns a pooled 2-D array, which is what the
    default configuration produces. A plain encoder model returns token-level
    3-D output instead; mean-pooling it here means swapping HF_EMBEDDING_MODEL
    for such a model still works rather than failing with a shape error.
    """
    if not isinstance(data, list) or not data:
        raise EmbeddingError("feature-extraction returned no data")

    first = data[0]
    if isinstance(first, (int, float)):
        # A single vector for a single input.
        return [[float(x) for x in data]]

    if isinstance(first, list) and first and isinstance(first[0], (int, float)):
        return [[float(x) for x in row] for row in data]

    if isinstance(first, list) and first and isinstance(first[0], list):
        pooled: list[list[float]] = []
        for tokens in data:
            if not tokens:
                raise EmbeddingError("feature-extraction returned an empty token matrix")
            width = len(tokens[0])
            sums = [0.0] * width
            for token in tokens:
                for i, value in enumerate(token):
                    sums[i] += float(value)
            pooled.append([total / len(tokens) for total in sums])
        return pooled

    raise EmbeddingError("unrecognised feature-extraction response shape")
