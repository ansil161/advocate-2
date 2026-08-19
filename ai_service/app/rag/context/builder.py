"""Choosing which retrieved chunks actually reach the model.

The naive version — concatenate hits in score order until the budget runs out —
has two failure modes this module exists to fix, both of which produce a
plausible-looking prompt that quietly makes the answer worse.

**One page crowding out the rest.** A long advocate profile splits into five
chunks that all score highly on "tell me about the team". Sent in score order
they consume the whole budget, and a question the Team index page would have
answered gets five overlapping fragments of one person instead. So chunks are
capped per source document, and the cap is lifted only if budget remains after
every document has had a turn.

**Near-duplicate text.** Chunking overlaps by design, so consecutive chunks of
one document share a sentence or two. Presenting the same sentence three times
wastes budget and, worse, reads to the model as three independent
corroborations of the same fact.

Ordering is by relevance rather than by document, deliberately. The model is
told the passages are reference material, not a narrative, and putting the
best-matching passage first is what keeps a truncated context useful rather
than merely complete.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.rag.context.deduplication import is_duplicate, shingles
from app.rag.retrieval.rrf import FusedHit

# Two chunks sharing this proportion of their words are treated as the same
# passage. Set from the chunk overlap: 110 chars of a 700-char chunk is ~16%,
# so legitimate neighbours land well below this and true duplicates well above.


@dataclass(frozen=True)
class BuiltContext:
    """The selected passages, and what was left out getting there."""

    hits: list[FusedHit]
    used_chars: int
    dropped_duplicate: int
    dropped_budget: int
    dropped_document_cap: int

    @property
    def documents(self) -> int:
        return len({hit.hit.document for hit in self.hits})


def build_context(hits: list[FusedHit], settings: Settings, *, limit: int | None = None) -> BuiltContext:
    """Select passages under a character budget, diverse and de-duplicated.

    ``limit`` caps how many passages are selected. It is applied *here* rather
    than by truncating the result afterwards, so that the budget accounting and
    the document count describe what is actually sent to the model — truncating
    later leaves both overstating a context the model never saw.
    """
    budget = settings.rag_max_context_chars
    per_document = settings.rag_max_chunks_per_document

    # The cap exists to stop one source crowding out the others. When every
    # candidate came from the same document there is nothing to crowd out, and
    # enforcing it would mean answering "tell me about Sridhar Lendalay" from
    # two fragments of his profile while the rest of it sat unused. So the cap
    # is a hard limit whenever the candidates are diverse, and lifted entirely
    # when they are not.
    single_document = len({hit.hit.document for hit in hits}) <= 1
    effective_cap = len(hits) if single_document else per_document

    selected: list[FusedHit] = []
    signatures: list[set[str]] = []
    per_document_count: dict[str, int] = {}
    used = 0
    dropped_duplicate = dropped_budget = dropped_cap = 0

    for hit in hits:
        if limit is not None and len(selected) >= limit:
            break

        if per_document_count.get(hit.hit.document, 0) >= effective_cap:
            dropped_cap += 1
            continue

        signature = shingles(hit.hit.text)
        if is_duplicate(signature, signatures):
            dropped_duplicate += 1
            continue

        cost = len(hit.hit.text)
        if used + cost > budget:
            # Not a break: a later, shorter chunk may still fit, and dropping
            # it only because a long one came first would waste the budget.
            dropped_budget += 1
            continue

        selected.append(hit)
        signatures.append(signature)
        per_document_count[hit.hit.document] = per_document_count.get(hit.hit.document, 0) + 1
        used += cost

    return BuiltContext(
        hits=selected,
        used_chars=used,
        dropped_duplicate=dropped_duplicate,
        dropped_budget=dropped_budget,
        dropped_document_cap=dropped_cap,
    )
