"""Qdrant access, scoped to this service's own collection.

The cluster this connects to may be shared with other projects. Every method
here addresses ``settings.qdrant_collection`` by name and nothing else: there is
no call that lists collections, and no call that deletes one it was not
explicitly asked to rebuild. A shared cluster should not be able to lose an
unrelated collection because an indexer was run with the wrong .env.
"""

from __future__ import annotations

from typing import Sequence

from qdrant_client import AsyncQdrantClient, models

from app.core.config import Settings
from app.core.exceptions import VectorStoreError
from app.core.logging import get_logger
# The domain type this adapter produces. Owned by core so that the retrieval
# layer does not have to import a vector-store module to name its own data.
from app.core.types import SearchHit

log = get_logger(__name__)


class QdrantStore:
    """Async wrapper over the one collection this service owns."""

    def __init__(self, settings: Settings, client: AsyncQdrantClient) -> None:
        self._settings = settings
        self._client = client
        self._collection = settings.qdrant_collection

    @property
    def collection(self) -> str:
        return self._collection

    async def exists(self) -> bool:
        try:
            return await self._client.collection_exists(self._collection)
        except Exception as exc:  # noqa: BLE001 — any transport failure is the same signal here
            raise VectorStoreError(f"collection_exists failed: {type(exc).__name__}") from exc

    async def count(self) -> int:
        try:
            result = await self._client.count(self._collection, exact=True)
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"count failed: {type(exc).__name__}") from exc
        return int(result.count)

    async def ensure_collection(self, *, dim: int, recreate: bool = False) -> None:
        """Create the collection if absent, or rebuild it when asked.

        ``recreate`` is only ever passed by the indexer, and only for this
        service's own collection — a vector size cannot be altered in place, so
        changing the embedding model genuinely requires a rebuild.
        """
        try:
            present = await self._client.collection_exists(self._collection)
            if present and recreate:
                log.info(
                    "dropping collection for rebuild",
                    extra={"event": "collection_drop", "collection": self._collection},
                )
                await self._client.delete_collection(self._collection)
                present = False
            if not present:
                await self._client.create_collection(
                    collection_name=self._collection,
                    vectors_config=models.VectorParams(size=dim, distance=models.Distance.COSINE),
                )
                log.info(
                    "collection created",
                    extra={"event": "collection_create", "collection": self._collection},
                )
            await self._ensure_payload_indexes()
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"ensure_collection failed: {type(exc).__name__}: {exc}") from exc

    async def _ensure_payload_indexes(self) -> None:
        """Index the payload fields that are filtered on.

        Qdrant refuses a filter on an unindexed field outright — "Index required
        but not found" — rather than falling back to a slow scan. So this is not
        an optimisation: without it, deleting an admin document's vectors fails,
        and delete-then-write reindexing cannot work at all.

        Idempotent, and each field is attempted independently: re-creating an
        existing index is a no-op that some server versions still report as an
        error, and one such report must not prevent the other index from being
        created.
        """
        for field in ("document_id", "source", "category"):
            try:
                await self._client.create_payload_index(
                    collection_name=self._collection,
                    field_name=field,
                    field_schema=models.PayloadSchemaType.KEYWORD,
                    wait=True,
                )
            except Exception as exc:  # noqa: BLE001 — "already exists" is the common case
                log.debug(
                    "payload index not created",
                    extra={"event": "payload_index", "reason": f"{field}: {type(exc).__name__}"},
                )

    async def upsert(self, points: Sequence[models.PointStruct]) -> None:
        if not points:
            return
        try:
            await self._client.upsert(collection_name=self._collection, points=list(points), wait=True)
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"upsert failed: {type(exc).__name__}: {exc}") from exc

    async def delete_by_document(self, document_id: int | str) -> None:
        """Remove every vector belonging to one admin-managed document.

        The delete half of delete-then-write. Filtering on the payload rather
        than tracking point ids elsewhere means the vectors are addressable
        from the document alone, so a reindex cannot orphan chunks whose ids
        someone forgot to record — which is the usual way a stale answer
        outlives the content that produced it.

        Scoped by ``source="admin"`` as well as by id, so a document id can
        never collide with the site-exported corpus and delete site content.
        """
        try:
            await self._client.delete(
                collection_name=self._collection,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="document_id", match=models.MatchValue(value=str(document_id))
                            ),
                            models.FieldCondition(
                                key="source", match=models.MatchValue(value="admin")
                            ),
                        ]
                    )
                ),
                wait=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"delete_by_document failed: {type(exc).__name__}: {exc}") from exc

    async def get_chunks_by_document(self, document_id: int | str) -> list[dict]:
        """Fetch all chunks for a specific document. Used for admin verification."""
        try:
            scroll_result, _ = await self._client.scroll(
                collection_name=self._collection,
                scroll_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id", match=models.MatchValue(value=str(document_id))
                        ),
                        models.FieldCondition(
                            key="source", match=models.MatchValue(value="admin")
                        ),
                    ]
                ),
                limit=1000,
                with_payload=True,
                with_vectors=False,
            )
            return [point.payload for point in scroll_result if point.payload]
        except Exception as exc:
            raise VectorStoreError(f"scroll failed: {type(exc).__name__}: {exc}") from exc

    async def count_by_document(self, document_id: int | str) -> int:
        """How many vectors a document currently has. Used to verify a reindex."""
        try:
            result = await self._client.count(
                self._collection,
                count_filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key="document_id", match=models.MatchValue(value=str(document_id))
                        ),
                        models.FieldCondition(key="source", match=models.MatchValue(value="admin")),
                    ]
                ),
                exact=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"count_by_document failed: {type(exc).__name__}") from exc
        return int(result.count)

    async def search(
        self,
        vector: list[float],
        *,
        limit: int,
        score_threshold: float | None = None,
        category: str | None = None,
    ) -> list[SearchHit]:
        """Nearest neighbours, optionally filtered to one content category.

        The threshold is applied by Qdrant rather than in Python so that a query
        matching nothing costs one round trip and returns an empty list, instead
        of returning the corpus' least-bad answers for this service to discard.
        """
        query_filter = None
        if category:
            query_filter = models.Filter(
                must=[models.FieldCondition(key="category", match=models.MatchValue(value=category))]
            )

        try:
            response = await self._client.query_points(
                collection_name=self._collection,
                query=vector,
                limit=limit,
                score_threshold=score_threshold,
                query_filter=query_filter,
                with_payload=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorStoreError(f"search failed: {type(exc).__name__}: {exc}") from exc

        return [SearchHit.from_payload(point.payload, point.score) for point in response.points]
