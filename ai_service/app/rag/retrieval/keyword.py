"""An in-memory BM25 index over the same corpus Qdrant holds.

This exists for one reason: Hugging Face's embedding endpoint is the single
most likely thing in this service to be briefly unavailable, and without a
query vector there is no vector search. Rather than let a cold start turn every
question into "I don't have enough information", the retrieval layer falls back
to matching words instead of meaning.

It is genuinely worse than vector search — it cannot tell that "property
dispute" and "partition suit" are related — but it is grounded in exactly the
same approved text, which is the property that matters. A lexical answer is
still an answer the firm wrote.

The corpus is 63 chunks. Scoring all of them per query is a few hundred
microseconds, so there is no index-time structure here beyond term frequencies.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass

from app.core.types import SearchHit
from app.rag.ingestion.chunker import KnowledgeChunk

# Standard BM25 constants. k1 damps the effect of a term appearing many times
# in one chunk; b controls how much a longer chunk is penalised for it.
_K1 = 1.5
_B = 0.75

# The share of a query's distinct terms a chunk must contain to count as a
# match at all. See the note in `search` — this is the hallucination brake for
# the lexical path, and the equivalent of the cosine threshold on the vector
# path. Half is deliberately demanding: this fallback should decline rather
# than reach.
MIN_TERM_COVERAGE = 0.5

# Short function words carry no retrieval signal but do appear in nearly every
# chunk, so leaving them in mostly flattens the ranking.
_STOPWORDS = frozenset(
    """a an and are as at be but by can do does for from had has have how i if in
    is it its me my of on or our so than that the their them then there these they
    this to was we were what when where which who whom why will with you your""".split()
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS and len(t) > 1]


@dataclass
class _Entry:
    chunk: KnowledgeChunk
    counts: Counter[str]
    length: int


class LexicalIndex:
    """BM25 over the knowledge chunks, built once at startup."""

    def __init__(self, chunks: list[KnowledgeChunk]) -> None:
        self._entries: list[_Entry] = []
        document_frequency: Counter[str] = Counter()

        for chunk in chunks:
            tokens = tokenize(chunk.text)
            counts = Counter(tokens)
            self._entries.append(_Entry(chunk=chunk, counts=counts, length=len(tokens)))
            document_frequency.update(counts.keys())

        total = len(self._entries)
        self._average_length = (sum(e.length for e in self._entries) / total) if total else 0.0
        # Standard BM25 IDF, floored at a small positive value so that a term
        # present in every chunk contributes nothing rather than a negative
        # score that would actively push matching chunks down the ranking.
        self._idf = {
            term: max(1e-6, math.log(1 + (total - freq + 0.5) / (freq + 0.5)))
            for term, freq in document_frequency.items()
        }

    def __len__(self) -> int:
        return len(self._entries)

    def by_category(self, category: str, *, limit: int = 1) -> list[SearchHit]:
        """Chunks of one category, regardless of the query.

        Retrieval normally decides what the model may see, but a few
        instructions in the system prompt presuppose specific material — being
        told to give someone the firm's phone number is unsatisfiable if the
        contact chunk did not happen to rank. This is the escape hatch for
        those cases, and it draws from the same approved corpus, so it cannot
        introduce anything the firm has not published.

        Scored 0.0: these chunks were not retrieved on merit and must not be
        able to inflate a confidence assessment.
        """
        found: list[SearchHit] = []
        for entry in self._entries:
            if entry.chunk.category != category:
                continue
            chunk = entry.chunk
            found.append(
                SearchHit(
                    text=chunk.text,
                    title=chunk.title,
                    category=chunk.category,
                    document=chunk.document,
                    section=chunk.section,
                    url=chunk.url,
                    updated_at=chunk.updated_at,
                    score=0.0,
                )
            )
            if len(found) >= limit:
                break
        return found

    def search(self, query: str, *, limit: int, min_coverage: float = MIN_TERM_COVERAGE) -> list[SearchHit]:
        """Top matches as ``SearchHit``s, so callers cannot tell the source apart.

        Scores are squashed into 0..1 by dividing by the best score in this
        result set. BM25 is unbounded and not comparable to cosine similarity,
        so the absolute number is meaningless — but the *relative* ordering is
        real, and downstream code compares hits only against each other.

        That normalisation is also why ``min_coverage`` exists and is not
        optional. Relative scoring destroys the information about whether the
        *best* match was any good: "capital city of Brazil" matches one
        incidental "city" in "City Civil Courts", and dividing by itself
        promotes that to a perfect 1.0. Requiring a share of the query's own
        terms to be present is what distinguishes a real match from the least
        bad one, and on a law firm's site that distinction is the difference
        between declining to answer and answering about the wrong thing.
        """
        terms = tokenize(query)
        if not terms or not self._entries:
            return []

        distinct = set(terms)
        # A one-word query cannot be judged on coverage, so it must match that
        # single word outright; longer queries need a genuine share.
        required = max(1, math.ceil(len(distinct) * min_coverage))

        scored: list[tuple[float, _Entry]] = []
        for entry in self._entries:
            score = 0.0
            matched = 0
            for term in distinct:
                frequency = entry.counts.get(term, 0)
                if not frequency:
                    continue
                matched += 1
                norm = 1 - _B + _B * (entry.length / self._average_length if self._average_length else 1)
                score += self._idf.get(term, 0.0) * (frequency * (_K1 + 1)) / (frequency + _K1 * norm)
            if score > 0 and matched >= required:
                scored.append((score, entry))

        if not scored:
            return []

        scored.sort(key=lambda pair: pair[0], reverse=True)
        best = scored[0][0]
        return [
            SearchHit(
                text=entry.chunk.text,
                title=entry.chunk.title,
                category=entry.chunk.category,
                document=entry.chunk.document,
                section=entry.chunk.section,
                url=entry.chunk.url,
                updated_at=entry.chunk.updated_at,
                score=round(score / best, 4),
            )
            for score, entry in scored[:limit]
        ]
