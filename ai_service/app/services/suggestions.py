"""Follow-up questions, derived from the corpus rather than generated.

Asking the model to invent follow-ups would cost a second completion and would
happily propose questions the knowledge base cannot answer — an assistant that
suggests "What were the damages in your largest case?" and then declines to
answer it is worse than one that suggests nothing.

So these are built from the indexed corpus itself. Every suggestion names
something that is definitely in the knowledge base, because it was read out of
it at startup.
"""

from __future__ import annotations

from app.core.types import SearchHit
from app.rag.ingestion.chunker import KnowledgeChunk

# The opening set, shown before anyone has asked anything. Phrased as a visitor
# would type them, and each one maps onto a document that is always indexed.
_OPENING = (
    "What areas of law does SLA Advocates handle?",
    "Who founded the firm?",
    "Tell me about the firm's experience.",
    "How can I contact the firm?",
)

# What to offer next, by the category of whatever was just retrieved. Keyed to
# the categories set in knowledge/documents.py.
_BY_CATEGORY: dict[str, tuple[str, ...]] = {
    "practice-area": (
        "Which courts and tribunals does the firm appear before?",
        "What happens after I make contact?",
    ),
    "team": (
        "Who else is on the firm's bench?",
        "What areas of law does SLA Advocates handle?",
    ),
    "firm": (
        "What areas of law does SLA Advocates handle?",
        "Where is the firm's office?",
    ),
    "recognition": (
        "Tell me about the firm's experience.",
        "Who founded the firm?",
    ),
    "matter": (
        "What areas of law does SLA Advocates handle?",
        "Which courts and tribunals does the firm appear before?",
    ),
    "industry": (
        "What areas of law does SLA Advocates handle?",
        "How can I contact the firm?",
    ),
    "faq": (
        "What happens after I make contact?",
        "How can I contact the firm?",
    ),
    "contact": (
        "What happens after I make contact?",
        "What areas of law does SLA Advocates handle?",
    ),
}

# Offered when nothing was retrieved: steer back to ground the assistant can
# actually stand on rather than leaving a dead end.
_RECOVERY = (
    "What areas of law does SLA Advocates handle?",
    "How can I contact the firm?",
)

MAX_SUGGESTIONS = 3


class SuggestionEngine:
    def __init__(self, chunks: list[KnowledgeChunk]) -> None:
        # Practice-area names, in the order the site lists them, so a visitor
        # who has just read about one is offered a real neighbouring domain
        # rather than a generic prompt.
        seen: list[str] = []
        for chunk in chunks:
            if chunk.category == "practice-area" and chunk.section and chunk.section != "Index":
                if chunk.section not in seen:
                    seen.append(chunk.section)
        self._practice_areas = seen

    def opening(self) -> list[str]:
        return list(_OPENING)

    def follow_up(self, hits: list[SearchHit], asked: str = "") -> list[str]:
        if not hits:
            return list(_RECOVERY)

        top = hits[0]
        candidates: list[str] = list(_BY_CATEGORY.get(top.category, _RECOVERY))

        # After a practice area, offer a different one by name. Picked by
        # position rather than at random so the same question always produces
        # the same suggestions — a chat that reshuffles its own prompts on a
        # retry looks broken.
        if top.category == "practice-area" and top.section in self._practice_areas:
            index = self._practice_areas.index(top.section)
            neighbour = self._practice_areas[(index + 1) % len(self._practice_areas)]
            candidates.insert(0, f"What does the firm do in {neighbour}?")

        lowered_ask = asked.strip().lower()
        result: list[str] = []
        for candidate in candidates:
            if candidate.lower() == lowered_ask or candidate in result:
                continue
            result.append(candidate)
            if len(result) == MAX_SUGGESTIONS:
                break
        return result
