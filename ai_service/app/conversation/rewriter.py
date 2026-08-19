"""Query rewriting: turning a follow-up into something retrievable.

"Tell me more about banking" carries almost no retrievable signal on its own.
Embed it alone and it lands nowhere near the Banking & Financial Laws page; the
words that make it answerable were in the *previous* turn.

This lives under ``conversation`` rather than under ``rag/retrieval`` because it
is conversation state doing the work, not a retrieval algorithm — and because
the distinction is load-bearing. The model can already see the history in its
message list; the *retriever* cannot, and it is the retriever that decides what
the model is allowed to know. A grounded assistant that forgets context at the
retrieval layer will politely decline to answer a question it just answered.
"""

from __future__ import annotations

# Below this length the previous question is folded into the search query so
# the pronoun has something to attach to. Long messages are left alone — they
# carry their own context, and prepending history to them mostly dilutes the
# match.
CONTEXT_CARRY_MAX_CHARS = 80


def build_search_query(message: str, history: list[dict[str, str]] | None = None) -> str:
    """Compose what actually gets embedded, which is not always the message."""
    message = message.strip()
    if not history or len(message) > CONTEXT_CARRY_MAX_CHARS:
        return message

    previous = [turn["content"] for turn in history if turn.get("role") == "user"]
    if not previous:
        return message
    return f"{previous[-1]} {message}".strip()
