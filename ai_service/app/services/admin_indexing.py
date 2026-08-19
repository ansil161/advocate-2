"""Publishing one admin-authored document version to the vector store.

Lifted out of ``api/routes/internal.py``, where chunking, embedding, deleting
and upserting all happened inside the request handler. That made the route the
only place the publish *sequence* was written down — and the order of that
sequence is the correctness property, not an implementation detail:

**Embed before deleting.** If the embedding call fails, the currently published
vectors are still in place and the document keeps answering from its previous
version instead of silently going dark.

**Delete before writing, then read back.** Publishing a new version first
removes every vector carrying the document's id. Doing it the other way round
leaves the old version's chunks alive alongside the new ones whenever the new
version splits into fewer pieces — and the stale chunk still retrieves, so the
assistant answers from content the firm has already replaced. The count is read
back from Qdrant afterwards, so "indexed" is a claim Qdrant makes rather than
one this service assumes.

Sharing ``index_chunks`` with the corpus indexer was considered and not done:
that path upserts a whole corpus and never deletes by document id, and merging
the two would mean one function with a flag deciding whether it is allowed to
delete. Two short, obvious functions beat one with a dangerous parameter.
"""

from __future__ import annotations

from dataclasses import dataclass

from qdrant_client import models

from app.core.logging import get_logger
from app.rag.ingestion.admin_chunker import build_admin_chunks

log = get_logger(__name__)

# Matches the corpus indexer. Small enough that a cold model does not time out
# on the first call.
BATCH_SIZE = 16


class EmptyDocument(ValueError):
    """The document produced no chunks, so there is nothing to publish."""


@dataclass(frozen=True)
class PublishOutcome:
    document_id: str
    version: int
    chunks_indexed: int


async def publish_document(
    *,
    document_id: str,
    version: int,
    title: str,
    content: str,
    category: str,
    slug: str,
    source_url: str,
    updated_at: str,
    store,  # noqa: ANN001 - QdrantStore
    embedder,  # noqa: ANN001 - GeminiEmbedder | HuggingFaceClient
    dim: int,
) -> PublishOutcome:
    """Chunk, embed and publish one version, replacing any previous one."""
    chunks = build_admin_chunks(
        document_id=document_id,
        version=version,
        title=title,
        content=content,
        category=category,
        slug=slug,
        source_url=source_url,
        updated_at=updated_at,
    )
    if not chunks:
        raise EmptyDocument("document produced no chunks")

    await store.ensure_collection(dim=dim)

    vectors: list[list[float]] = []
    for start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[start : start + BATCH_SIZE]
        vectors.extend(await embedder.embed([c.text for c in batch], task="document"))

    await store.delete_by_document(document_id)
    await store.upsert(
        [
            models.PointStruct(id=chunk.id, vector=vector, payload=chunk.payload())
            for chunk, vector in zip(chunks, vectors)
        ]
    )
    indexed = await store.count_by_document(document_id)

    log.info(
        "admin document indexed",
        extra={
            "event": "admin_index",
            "document": document_id,
            "version": version,
            "chunks": indexed,
        },
    )
    return PublishOutcome(document_id=document_id, version=version, chunks_indexed=indexed)


async def unpublish_document(document_id: str, *, store) -> int:  # noqa: ANN001
    """Remove a document's vectors. Returns how many remain, read back."""
    await store.delete_by_document(document_id)
    remaining = await store.count_by_document(document_id)
    log.info(
        "admin document unindexed",
        extra={"event": "admin_unindex", "document": document_id, "chunks": remaining},
    )
    return remaining
