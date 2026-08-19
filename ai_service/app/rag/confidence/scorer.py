"""How sure the pipeline is that the corpus actually answers the question.

The failure this exists to prevent: retrieval always returns *something*. Ask a
vector store for the five nearest chunks and it returns five chunks, ranked, no
matter what was asked. "Top result" and "correct result" are different claims,
and treating the first as the second is how a grounded assistant starts
answering confidently about things the firm never published.

Four signals, because each is blind in a different way:

* **Absolute similarity** — the only signal on a meaningful scale. RRF ranks
  and BM25 sums say a chunk was the best available; only cosine (or the
  reranker's 0..1) says whether the best available was any good.
* **Branch agreement** — vector search and BM25 fail differently. Vector search
  surfaces the semantically adjacent; BM25 surfaces the incidentally
  word-sharing. A chunk both found is corroborated by two methods that would
  not make the same mistake.
* **Supporting chunks** — one strong chunk can be a lucky match. Several
  clustered above the floor means the corpus genuinely covers the topic.
* **Document diversity** — several chunks of one long page agreeing is one
  source, not three. Counted by document, so a single page cannot vote twice.

Thresholds are configuration, and the defaults are derived from the same
calibration that set RAG_SCORE_THRESHOLD rather than picked for looking round.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.core.config import Settings
from app.rag.retrieval.rrf import FusedHit


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class Assessment:
    """The verdict, plus the numbers behind it.

    The fields exist so the decision is inspectable in logs and in the admin
    retrieval tester. A confidence system whose reasoning cannot be read is one
    nobody will trust enough to tune.
    """

    level: Confidence
    top_similarity: float
    supporting: int
    documents: int
    corroborated: bool
    reason: str

    @property
    def answerable(self) -> bool:
        """LOW means decline. The whole point of the module."""
        return self.level is not Confidence.LOW


def assess(hits: list[FusedHit], settings: Settings) -> Assessment:
    if not hits:
        return Assessment(
            level=Confidence.LOW,
            top_similarity=0.0,
            supporting=0,
            documents=0,
            corroborated=False,
            reason="retrieval returned nothing",
        )

    # Keyword-only, because the embedding endpoint or the vector store is down.
    # BM25 scores are normalised against the best hit in their own result set,
    # so they are ordinal, not absolute — comparing them to a cosine threshold
    # is a category error, and doing so would reject every hit and turn a
    # working degraded mode into "I don't have that information".
    #
    # The lexical branch has already applied its own admission rules (a term
    # coverage requirement and a relative floor), so hits that reach here are
    # genuine matches against approved text. They are capped at MEDIUM: a word
    # match is real evidence, but it is not the corroboration HIGH claims.
    if not any(hit.vector_score is not None for hit in hits):
        best_keyword = max((hit.keyword_score or 0.0) for hit in hits)
        return Assessment(
            level=Confidence.MEDIUM,
            top_similarity=best_keyword,
            supporting=len(hits),
            documents=len({hit.hit.document for hit in hits}),
            corroborated=False,
            reason="keyword-only retrieval (vector branch unavailable)",
        )

    top = max(hit.best_similarity for hit in hits)
    floor = settings.rag_support_floor
    supporting_hits = [hit for hit in hits if hit.best_similarity >= floor]
    documents = len({hit.hit.document for hit in supporting_hits})
    corroborated = any(hit.found_by_both for hit in hits)

    # Below the retrieval threshold nothing else can rescue it. A chunk the
    # vector space did not consider close is not made relevant by having been
    # returned alongside four others.
    if top < settings.rag_score_threshold:
        return Assessment(
            level=Confidence.LOW,
            top_similarity=top,
            supporting=len(supporting_hits),
            documents=documents,
            corroborated=corroborated,
            reason=f"best similarity {top:.3f} below threshold {settings.rag_score_threshold:.2f}",
        )

    strong = top >= settings.rag_confidence_high
    if strong and (corroborated or documents >= 2):
        return Assessment(
            level=Confidence.HIGH,
            top_similarity=top,
            supporting=len(supporting_hits),
            documents=documents,
            corroborated=corroborated,
            reason="strong match with independent support",
        )

    return Assessment(
        level=Confidence.MEDIUM,
        top_similarity=top,
        supporting=len(supporting_hits),
        documents=documents,
        corroborated=corroborated,
        reason=(
            "strong match but only one source"
            if strong
            else f"moderate match ({top:.3f})"
        ),
    )
