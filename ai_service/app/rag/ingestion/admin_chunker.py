"""Chunking for admin-authored documents.

Reuses the site corpus' splitter rather than reimplementing it, so a document
written in the admin panel is broken up on exactly the same rules as a practice
area page — same chunk ceiling, same overlap, same sentence-boundary
preference. Two chunking strategies feeding one collection would mean retrieval
quality depended on where a fact happened to be authored, which is not a
distinction a visitor should be able to feel.

Two things differ from the site corpus, both structural rather than editorial:

**Point ids are derived from document, version and chunk index.** That is what
makes reindexing idempotent — running the same job twice overwrites the same
points instead of accumulating a second copy — and what makes the vectors
addressable for deletion without a separate id table.

**Every payload carries ``source="admin"`` and ``document_id``.** The site
corpus carries neither. That separation is load-bearing: it is what lets a
document's vectors be deleted by filter without any risk of matching an
exported page, and what lets retrieval tell the two origins apart.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from app.rag.ingestion.chunker import split_body

# Distinct from the site corpus' namespace, so an admin document and an
# exported page can never derive the same point id.
_ADMIN_NAMESPACE = uuid.UUID("b1f0c4a2-7d38-5e91-9a44-2c7f6e0d1b53")


@dataclass(frozen=True)
class AdminChunk:
    """One retrievable piece of an admin-authored document."""

    document_id: str
    version: int
    index: int
    text: str
    title: str
    category: str
    slug: str
    source_url: str
    updated_at: str

    @property
    def id(self) -> str:
        """Deterministic, so a repeated job is an overwrite rather than a duplicate."""
        return str(uuid.uuid5(_ADMIN_NAMESPACE, f"{self.document_id}/{self.version}#{self.index}"))

    def payload(self) -> dict[str, Any]:
        return {
            # Retrieval reads these, and they must mean the same thing as the
            # site corpus' equivalents or the two origins would rank and
            # attribute inconsistently.
            "text": self.text,
            "title": self.title,
            "category": self.category,
            "document": self.title,
            "section": f"part {self.index + 1}" if self.index else "",
            "url": self.source_url,
            "updated_at": self.updated_at,
            # Admin-only bookkeeping. Never surfaced to a visitor — the response
            # schema is an allow-list that excludes them.
            "source": "admin",
            "document_id": str(self.document_id),
            "version": self.version,
        }


def build_admin_chunks(
    *,
    document_id: str,
    version: int,
    title: str,
    content: str,
    category: str,
    slug: str,
    source_url: str = "",
    updated_at: str = "",
) -> list[AdminChunk]:
    """Split one admin document into chunks, each carrying its own heading.

    The title is prefixed onto every chunk for the same reason the site corpus
    repeats its headings: a chunk is retrieved alone, and "the deadline is
    thirty days" is useless — and potentially misleading — without the document
    that says what it is the deadline for.
    """
    body = content.strip()
    if not body:
        return []

    parts = split_body(body)
    total = len(parts)
    return [
        AdminChunk(
            document_id=str(document_id),
            version=version,
            index=index,
            text=f"{title}{f' (part {index + 1} of {total})' if total > 1 else ''}\n{part}".strip(),
            title=title,
            category=category,
            slug=slug,
            source_url=source_url,
            updated_at=updated_at,
        )
        for index, part in enumerate(parts)
    ]
