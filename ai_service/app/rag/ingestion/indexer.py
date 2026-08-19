"""Publishing chunks to the vector store.

Extracted from ``scripts/index_knowledge.py`` so that indexing is application
code a script *calls*, rather than logic that only exists inside a CLI. That
matters here for a specific reason: the admin ingestion path in
``api/routes/internal.py`` does the same three things — ensure the collection,
embed in batches, upsert — and while the two are not yet one function, having
this one importable is what makes converging them possible without a script
rewrite.

**The embedder is resolved through the same factory the running service uses.**
Not a convenience: a collection's vectors and a query's vector must come from
the same model or they land in different spaces, and the failure mode is not an
error but silently meaningless similarity scores. Building the embedder any
other way here would make that divergence a one-line mistake.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from qdrant_client import models

from app.core.logging import get_logger
from app.rag.ingestion.chunker import KnowledgeChunk

log = get_logger(__name__)

# Small enough that a cold model does not time out on the first call, large
# enough that 63 chunks take a handful of round trips rather than 63.
BATCH_SIZE = 16


@dataclass(frozen=True)
class IndexOutcome:
    """What actually landed, read back from the store rather than assumed."""

    upserted: int
    collection_total: int

    @property
    def orphans(self) -> int:
        """Points present in the collection but not in the current corpus.

        Not an error: a rename or deletion in the site's content leaves a point
        whose key no longer exists. Worth surfacing, because the fix is a
        rebuild rather than another upsert.
        """
        return max(0, self.collection_total - self.upserted)


async def index_chunks(
    chunks: list[KnowledgeChunk],
    *,
    store,  # noqa: ANN001 - QdrantStore
    embedder,  # noqa: ANN001 - GeminiEmbedder | HuggingFaceClient
    dim: int,
    rebuild: bool = False,
    on_progress: Callable[[int, int], None] | None = None,
) -> IndexOutcome:
    """Embed and upsert every chunk, replacing points in place.

    Chunk ids are a deterministic hash of their key, so a plain run overwrites
    each point rather than accumulating a second copy of the corpus. ``rebuild``
    exists for the one case that cannot be done in place: changing the embedding
    model, and with it the collection's fixed vector width.
    """
    await store.ensure_collection(dim=dim, recreate=rebuild)

    points: list[models.PointStruct] = []
    for start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[start : start + BATCH_SIZE]
        # "document", the counterpart to the "query" the retrieval layer uses.
        # Embedding both sides identically costs recall.
        vectors = await embedder.embed([c.text for c in batch], task="document")
        points.extend(
            models.PointStruct(id=chunk.id, vector=vector, payload=chunk.payload())
            for chunk, vector in zip(batch, vectors)
        )
        if on_progress:
            on_progress(min(start + BATCH_SIZE, len(chunks)), len(chunks))

    await store.upsert(points)
    total = await store.count()

    log.info(
        "corpus indexed",
        extra={"event": "index", "chunks": len(points), "collection_total": total},
    )
    return IndexOutcome(upserted=len(points), collection_total=total)
