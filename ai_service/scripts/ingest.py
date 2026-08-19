"""Publish the firm's knowledge base to Qdrant.

    python scripts/ingest.py            # create if needed, upsert all
    python scripts/ingest.py --rebuild  # drop and recreate first
    python scripts/ingest.py --dry-run  # chunk and report, call nothing

Run after ``npm run knowledge`` in client/ whenever the site's content changes.

Chunk ids are a deterministic hash of their key, so a plain run overwrites each
point in place — running this twice does not produce two copies of the corpus.
``--rebuild`` exists for the one case that cannot be done in place: changing the
embedding model, and with it the collection's fixed vector width.

Only ``QDRANT_COLLECTION`` is ever touched. Nothing here lists or deletes any
other collection, which matters because the cluster may be shared.

The indexing itself lives in ``app.rag.ingestion.indexer``; this file is the
command-line front for it.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from _bootstrap import bootstrap  # noqa: E402 - must run before app imports

import httpx  # noqa: E402
from qdrant_client import AsyncQdrantClient  # noqa: E402

from app.clients.qdrant import QdrantStore  # noqa: E402
from app.core.exceptions import ChatError  # noqa: E402
from app.llm.factory import build_embedder  # noqa: E402
from app.llm.providers.huggingface import HuggingFaceClient  # noqa: E402
from app.rag.ingestion.corpus import build_chunks  # noqa: E402
from app.rag.ingestion.indexer import index_chunks  # noqa: E402


async def main(rebuild: bool, dry_run: bool) -> int:
    settings = bootstrap()

    chunks = build_chunks()
    documents = len({c.key.split("#")[0] for c in chunks})
    print(f"knowledge base: {len(chunks)} chunks from {documents} documents")

    by_category: dict[str, int] = {}
    for chunk in chunks:
        by_category[chunk.category] = by_category.get(chunk.category, 0) + 1
    for category, count in sorted(by_category.items()):
        print(f"  {count:>4}  {category}")

    if dry_run:
        longest = max(chunks, key=lambda c: len(c.text))
        print(f"\ndry run — nothing sent. Longest chunk is {len(longest.text)} chars ({longest.key}).")
        return 0

    if not settings.embeddings_configured:
        need = "GEMINI_API_KEY" if settings.uses_gemini_embeddings else "HF_TOKEN"
        print(f"\n{need} is not set in .env — cannot embed. Add it and re-run.", file=sys.stderr)
        return 2
    if not settings.vector_store_configured:
        print("\nQDRANT_URL / QDRANT_API_KEY are not set in .env.", file=sys.stderr)
        return 2

    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.embedding_timeout_seconds)) as http_client:
        qdrant_client = AsyncQdrantClient(
            url=settings.qdrant_url, api_key=settings.qdrant_api_key, timeout=30
        )
        try:
            # Resolved through the same function the service uses, so the model
            # that indexes is by construction the model that queries.
            embedder = build_embedder(settings, http_client, HuggingFaceClient(settings, http_client))
            store = QdrantStore(settings, qdrant_client)

            print(f"\nembedder: {embedder.name}")
            print(f"collection '{store.collection}' — {settings.embedding_dim}-dim, cosine")

            outcome = await index_chunks(
                chunks,
                store=store,
                embedder=embedder,
                dim=settings.embedding_dim,
                rebuild=rebuild,
                on_progress=lambda done, total: print(f"  embedded {done:>3}/{total}"),
            )

            print(
                f"\nupserted {outcome.upserted} points — "
                f"collection now holds {outcome.collection_total}"
            )
            if outcome.orphans:
                print(
                    f"note: {outcome.orphans} point(s) in the collection are not in the current "
                    "knowledge base. Re-run with --rebuild to drop them."
                )
            return 0
        except ChatError as exc:
            print(f"\nfailed: {exc.detail}", file=sys.stderr)
            return 1
        finally:
            await qdrant_client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--rebuild", action="store_true", help="drop and recreate the collection first")
    parser.add_argument("--dry-run", action="store_true", help="chunk and report without calling any API")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(rebuild=args.rebuild, dry_run=args.dry_run)))
