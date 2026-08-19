"""Turns the firm's exported content into retrievable, attributable chunks.

Everything the assistant is allowed to say comes from here. The input is
``data/knowledge.json``, generated from the website's own ``src/data/*.js`` by
``npm run knowledge`` — so this module composes and shapes, but never authors.
No sentence in this file states a fact about the firm that the site does not
already state.

Two decisions in here do most of the work:

**Every chunk repeats its own heading.** A retrieved chunk arrives at the model
with no neighbours, so "he was enrolled in 1996" is useless unless the chunk
also says who *he* is. Each document therefore carries a short header that is
re-prefixed to every piece it is split into. It costs a few tokens and removes
a whole class of confidently-wrong answers.

**Chunks are small on purpose.** The default embedding model
(all-MiniLM-L6-v2) reads about 256 tokens and silently ignores the rest, so a
1,800-character advocate profile embedded whole would have half its content
invisible to search while still being served to the model as if it had matched.
``MAX_CHUNK_CHARS`` is set below that ceiling deliberately.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from app.rag.ingestion.cleaner import _sentences


# Sized to the embedding model's real attention window rather than to what
# looks tidy. See the module docstring.
MAX_CHUNK_CHARS = 700
# Enough to carry a sentence across a split so a fact that straddles the seam
# is retrievable from either side.
CHUNK_OVERLAP_CHARS = 110

# A fixed namespace, so a chunk's id is a pure function of its key. Re-running
# the indexer therefore overwrites points in place instead of accumulating a
# second copy of the corpus beside the first.
_ID_NAMESPACE = uuid.UUID("6f9f5d64-1f6a-5c3e-9c1a-51a0dc2f0b77")


@dataclass(frozen=True)
class KnowledgeChunk:
    """One retrievable unit, and everything needed to attribute it."""

    key: str
    text: str
    title: str
    category: str
    document: str
    section: str
    url: str
    updated_at: str

    @property
    def id(self) -> str:
        """Deterministic point id. Qdrant accepts a UUID string directly."""
        return str(uuid.uuid5(_ID_NAMESPACE, self.key))

    def payload(self) -> dict[str, Any]:
        """The Qdrant payload — also what the retrieval layer reads back.

        Deliberately carries the text: an answer has to be composable from a
        search result alone, without a second lookup into a store that might
        have moved on since indexing.
        """
        return {
            "text": self.text,
            "title": self.title,
            "category": self.category,
            "document": self.document,
            "section": self.section,
            "url": self.url,
            "updated_at": self.updated_at,
        }


# ── text helpers ─────────────────────────────────────────────────────────────


def split_body(body: str, max_chars: int = MAX_CHUNK_CHARS, overlap: int = CHUNK_OVERLAP_CHARS) -> list[str]:
    """Split a body into chunks that respect sentence boundaries where possible.

    Paragraphs are the preferred seam, sentences the next, and a hard character
    cut the last resort — a single unbroken 4,000-character sentence must still
    end up searchable rather than silently truncated at the model's window.
    """
    body = body.strip()
    if not body:
        return []
    if len(body) <= max_chars:
        return [body]

    units: list[str] = []
    for paragraph in (p.strip() for p in body.split("\n") if p.strip()):
        if len(paragraph) <= max_chars:
            units.append(paragraph)
            continue
        for sentence in _sentences(paragraph):
            while len(sentence) > max_chars:
                units.append(sentence[:max_chars])
                sentence = sentence[max_chars - overlap :]
            if sentence:
                units.append(sentence)

    chunks: list[str] = []
    current = ""
    for unit in units:
        candidate = f"{current}\n{unit}" if current else unit
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
            # Carry the tail of the finished chunk into the next one so a fact
            # spanning the seam is retrievable from either side.
            tail = current[-overlap:]
            current = f"{tail}\n{unit}" if len(tail) + len(unit) + 1 <= max_chars else unit
        else:
            current = unit
    if current:
        chunks.append(current)
    return chunks
