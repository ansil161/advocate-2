"""Request and response contracts for the chat endpoint.

The request model is the first line of defence, and it is deliberately strict.
Everything that reaches the RAG pipeline has already been proved to be a
short string and an id-shaped string — there is no path by which an oversized
body, a nested object or a surprise field gets as far as a paid API call.

The response model is the other half of that: it is an allow-list. Retrieval
scores, chunk text, model names, prompt fragments and internal identifiers
exist on the objects the service passes around and none of them appear here, so
they cannot be leaked by someone forgetting to strip a field.
"""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.config import get_settings

# An absolute ceiling independent of configuration, so that raising
# CHAT_MAX_MESSAGE_CHARS by mistake cannot turn the endpoint into somewhere to
# post a novel. The configured limit is enforced below and is always lower.
ABSOLUTE_MESSAGE_CEILING = 4000

# Conversation ids are minted by this service as uuid4 hex. Accepting only that
# shape means the id can never carry anything interesting — no path traversal,
# no log forging, no unbounded key in the conversation store.
_CONVERSATION_ID_RE = re.compile(r"^[a-f0-9]{8,64}$")


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    message: str = Field(min_length=1, max_length=ABSOLUTE_MESSAGE_CEILING)
    conversation_id: str | None = Field(default=None, max_length=64)

    @field_validator("message")
    @classmethod
    def _within_configured_limit(cls, value: str) -> str:
        # Checked after stripping, so a message of pure whitespace fails the
        # min_length rule rather than arriving as an empty question.
        limit = get_settings().chat_max_message_chars
        if len(value) > limit:
            raise ValueError(f"message must be {limit} characters or fewer")
        return value

    @field_validator("conversation_id")
    @classmethod
    def _id_shape(cls, value: str | None) -> str | None:
        if value in (None, ""):
            return None
        if not _CONVERSATION_ID_RE.match(value):
            raise ValueError("conversation_id is not a valid identifier")
        return value


class SourceOut(BaseModel):
    """Where an answer came from, in terms a visitor can click.

    A page and a section on this site — never a chunk id, a score, or anything
    that would describe how retrieval works.
    """

    title: str
    section: str
    url: str


class ChatResponse(BaseModel):
    answer: str
    conversation_id: str
    sources: list[SourceOut] = Field(default_factory=list)
    suggested_questions: list[str] = Field(default_factory=list)
    # "generated" | "quoted" | "no_context". The widget uses this to mark an
    # answer the firm's own material was quoted for rather than composed.
    mode: str = "generated"
    # True when a fallback path served the answer. Surfaced so the interface can
    # be honest about a degraded reply instead of presenting it as a full one.
    degraded: bool = False


class OpeningResponse(BaseModel):
    """What the widget needs before anyone has typed anything."""

    greeting: str
    suggested_questions: list[str]
