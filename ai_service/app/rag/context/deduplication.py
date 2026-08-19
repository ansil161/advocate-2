"""Near-duplicate detection between retrieved passages.

Two branches over one corpus, plus overlapping chunk windows, routinely surface
the same sentences twice. Sending both wastes the context budget on text the
model has already read and makes a single source look like corroboration when
the confidence policy counts documents.

Exact matching is useless here — the duplicates are *near* duplicates, differing
by a heading or by where the overlap window cut. Word bigrams over the shorter
passage catch a shared sentence while staying cheap enough to run per query on
every candidate.

Split out of ``builder.py`` because it answers a different question: the builder
decides what fits, this decides what is redundant. Extracting it also makes the
similarity rule testable on its own, which matters because the threshold is a
judgement call rather than a derived number.
"""

from __future__ import annotations

# Above this bigram overlap two passages are treated as the same text.
# Deliberately not 1.0: the duplicates worth dropping differ by a heading or by
# where an overlap window cut, so exact identity would catch almost none of them.
#
# 0.75 is carried over unchanged from the pre-refactor builder. It is a tuned
# value, not a round one — do not "tidy" it without re-measuring against the
# real corpus.
DUPLICATE_OVERLAP = 0.75


def shingles(text: str) -> set[str]:
    """Word bigrams — enough to catch a shared sentence, cheap enough per query.

    Falls back to unigrams for a passage too short to have a bigram, so a
    one-word chunk still compares as something rather than as the empty set.
    """
    words = text.lower().split()
    return {f"{a} {b}" for a, b in zip(words, words[1:])} or set(words)


def overlap(a: set[str], b: set[str]) -> float:
    """Containment, not Jaccard.

    Measured against the *shorter* passage on purpose: a short chunk wholly
    contained in a longer one is a duplicate, and Jaccard would score that pair
    low precisely because the lengths differ.
    """
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def is_duplicate(signature: set[str], seen: list[set[str]]) -> bool:
    """Whether this passage repeats something already selected."""
    return any(overlap(signature, other) >= DUPLICATE_OVERLAP for other in seen)
