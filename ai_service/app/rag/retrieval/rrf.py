"""Reciprocal Rank Fusion — merging two retrievers that do not share a scale.

Vector search returns cosine similarities (0..1, and on this corpus a genuine
match sits around 0.72). BM25 returns unbounded term-weighted sums where 8.4 is
a good score and means nothing on its own. Averaging or thresholding across the
two is meaningless, and normalising BM25 into 0..1 destroys the one thing it
reliably knows: the *order* it put things in.

RRF sidesteps the problem by throwing away the scores and keeping only the
ranks::

    score(d) = Σ  1 / (k + rank_i(d))
              i ∈ branches that found d

``k`` damps the influence of the very top positions, so a document ranked #1 by
one branch does not automatically beat a document ranked #2 and #3 by both. The
conventional k=60 is used here and is a genuine tunable, not a magic number:
lower it and the first position dominates, raise it and agreement between
branches matters more.

The property that earns its place on a law firm's site: a chunk both branches
found ranks above a chunk only one found. Vector search alone will confidently
surface something semantically adjacent to a question about an enrolment
number; BM25 alone will surface something that shares a rare word. Agreement
between two retrievers that fail differently is a real signal about whether the
corpus actually contains an answer.

**The original scores survive.** ``vector_score`` and ``keyword_score`` are
carried through untouched, because the confidence policy downstream needs the
absolute cosine value — RRF can only say a chunk was the best available, never
whether the best available was any good.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.core.types import SearchHit

# The conventional RRF constant. Damps the top ranks so that agreement between
# branches can outweigh a single branch's first place.
DEFAULT_K = 60


@dataclass(frozen=True)
class FusedHit:
    """One chunk, with every retrieval signal that produced it.

    Kept separate from ``SearchHit`` so that the transport-level object stays a
    plain record of what a store returned, and everything the pipeline *infers*
    about a chunk lives here. Nothing in this object reaches a visitor — it is
    for ranking, confidence and the admin retrieval tester.
    """

    hit: SearchHit
    rrf_score: float
    vector_score: float | None = None
    keyword_score: float | None = None
    vector_rank: int | None = None
    keyword_rank: int | None = None
    # Set by the reranker when one is enabled; None means it did not run.
    rerank_score: float | None = None

    @property
    def branches(self) -> int:
        """How many retrievers found this chunk. 2 is corroboration."""
        return (self.vector_rank is not None) + (self.keyword_rank is not None)

    @property
    def found_by_both(self) -> bool:
        return self.branches == 2

    @property
    def best_similarity(self) -> float:
        """The strongest absolute-scale signal available.

        Prefers the reranker's judgement, falls back to cosine. Deliberately
        never falls back to the BM25 number, which is not on a comparable scale
        and would make a confidence threshold meaningless.
        """
        if self.rerank_score is not None:
            return self.rerank_score
        return self.vector_score or 0.0

    def with_rerank(self, score: float) -> "FusedHit":
        return replace(self, rerank_score=score)


def chunk_key(hit: SearchHit) -> str:
    """Identity for deduplication across branches.

    The corpus has no stable chunk id on the retrieval path — Qdrant's point id
    is not carried into the payload, and the lexical index builds its hits from
    the in-memory corpus. The text is what actually makes a chunk unique, and
    both branches draw from the same source, so identical text really is the
    same chunk rather than a coincidence.
    """
    return hit.text


def reciprocal_rank_fusion(
    vector_hits: list[SearchHit],
    keyword_hits: list[SearchHit],
    *,
    k: int = DEFAULT_K,
    limit: int | None = None,
) -> list[FusedHit]:
    """Merge two ranked lists into one, preserving each branch's own signals.

    Ranks are 1-based and taken from list order, which is each retriever's own
    ordering. Ties are broken by absolute cosine, so that when RRF cannot
    separate two chunks the one the vector space actually preferred wins.
    """
    fused: dict[str, dict] = {}

    for branch, hits in (("vector", vector_hits), ("keyword", keyword_hits)):
        for rank, hit in enumerate(hits, start=1):
            key = chunk_key(hit)
            entry = fused.setdefault(key, {"hit": hit, "rrf": 0.0})
            entry["rrf"] += 1.0 / (k + rank)
            entry[f"{branch}_rank"] = rank
            entry[f"{branch}_score"] = hit.score
            # Prefer the vector branch's copy of the chunk: its `score` field
            # carries a cosine value, which is the scale the rest of the
            # pipeline reasons about.
            if branch == "vector":
                entry["hit"] = hit

    results = [
        FusedHit(
            hit=entry["hit"],
            rrf_score=round(entry["rrf"], 6),
            vector_score=entry.get("vector_score"),
            keyword_score=entry.get("keyword_score"),
            vector_rank=entry.get("vector_rank"),
            keyword_rank=entry.get("keyword_rank"),
        )
        for entry in fused.values()
    ]

    results.sort(key=lambda f: (f.rrf_score, f.vector_score or 0.0), reverse=True)
    return results[:limit] if limit else results
