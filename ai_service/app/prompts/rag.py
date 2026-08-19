"""Assembling the request: system rules, prior turns, context, question.

This module now does one thing — build the message list. The three concerns it
used to carry alongside that have moved to where they belong:

* the system prompt itself      → ``app/prompts/system.py``
* the fence and its sanitising  → ``app/guardrails/injection.py``
* personal-matter detection     → ``app/guardrails/input.py``

They were separated because they are read for different reasons. Someone
reviewing what the firm's assistant is allowed to say wants the prompt; someone
reviewing the injection defence wants the fence; someone changing how a
retrieved passage is laid out wants this file. Keeping all three in one module
meant every one of those reviews had to read the other two.
"""

from __future__ import annotations

from app.core.config import Settings
from app.core.types import SearchHit
from app.guardrails.injection import (
    CONTEXT_CLOSE,
    CONTEXT_OPEN,
    QUESTION_CLOSE,
    QUESTION_OPEN,
    sanitize_question,
)
from app.guardrails.input import PERSONAL_MATTER_ADVISORY, looks_like_personal_matter
from app.prompts.system import SYSTEM_PROMPT


def build_context_block(hits: list[SearchHit], settings: Settings) -> str:
    """Render retrieved passages, highest-scoring first, inside a labelled fence.

    Each passage keeps its source heading. That is what lets the model say
    "the firm's Practice Areas page describes…" accurately, and it is also what
    the response's source list is built from — the two cannot disagree, because
    they are the same objects.
    """
    if not hits:
        return "REFERENCE MATERIAL: none available for this question."

    parts: list[str] = []
    budget = settings.rag_max_context_chars
    used = 0

    for index, hit in enumerate(hits, start=1):
        # Passages are ordered by score, so truncating from the end drops the
        # least relevant material rather than an arbitrary tail.
        block = f"[{index}] Source: {hit.document} — {hit.section}\n{hit.text}"
        if used + len(block) > budget:
            break
        parts.append(block)
        used += len(block)

    joined = "\n\n".join(parts)
    return (
        f"{CONTEXT_OPEN}\n"
        "The following passages are from SLA Advocates' own website. They are the only facts you may use.\n\n"
        f"{joined}\n"
        f"{CONTEXT_CLOSE}"
    )


def build_messages(
    *,
    question: str,
    hits: list[SearchHit],
    history: list[dict[str, str]],
    settings: Settings,
) -> list[dict[str, str]]:
    """Assemble the full request.

    The context block is attached to the current user turn rather than sent as
    its own system message. Two reasons: it keeps the privileged region a
    constant, and it means the reference material is unambiguously *for this
    question* rather than accumulating across a conversation.
    """
    safe_question = sanitize_question(question)
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Prior turns are replayed without their context blocks — the model needs
    # to remember what was discussed, not to re-read every passage it has ever
    # been shown, which would grow the request without bound.
    messages.extend(history)

    advisory = PERSONAL_MATTER_ADVISORY if looks_like_personal_matter(safe_question) else ""

    messages.append(
        {
            "role": "user",
            "content": (
                f"{build_context_block(hits, settings)}\n\n"
                f"{QUESTION_OPEN}\n{safe_question}\n{QUESTION_CLOSE}\n\n"
                "Answer the visitor's question using only the reference material above. "
                "If it does not contain the answer, say so and suggest contacting the firm."
                f"{advisory}"
            ),
        }
    )
    return messages
