"""Rebuild the collection from scratch.

    python scripts/reindex.py

The one operation that cannot be done in place. A collection's vector width is
fixed when it is created, so changing ``EMBEDDING_PROVIDER`` or an embedding
dimension means dropping the collection and re-embedding every chunk — an
ordinary upsert would be rejected, or worse, would leave a mix of vectors from
two different models scoring against each other.

Deliberately a separate command from ``ingest.py`` rather than a flag someone
reaches for casually: it deletes every vector in ``QDRANT_COLLECTION`` first,
including any admin-authored documents published through Django, which then
need re-publishing from the admin panel.
"""

from __future__ import annotations

import asyncio

from _bootstrap import bootstrap  # noqa: E402

from ingest import main as ingest_main  # noqa: E402


async def main() -> int:
    settings = bootstrap()
    print(
        f"This drops and recreates collection '{settings.qdrant_collection}' "
        f"at {settings.embedding_dim} dimensions.\n"
        "Admin-published documents will need re-publishing from the panel afterwards."
    )
    # Same code path as ingest --rebuild. Having one implementation is the point:
    # a second rebuild routine would be a second place for the dimension to drift.
    return await ingest_main(rebuild=True, dry_run=False)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
