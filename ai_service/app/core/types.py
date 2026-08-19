"""Domain types shared across layers.

``SearchHit`` previously lived in ``clients/qdrant.py``, which made the vector
store's module the owner of the vocabulary that retrieval, fusion, prompting,
suggestions and the chat service all speak. Eight modules imported their central
data type from an infrastructure adapter — so the domain depended on a client,
which is the inversion the layering rules exist to prevent.

It lives in ``core`` rather than in ``rag`` because both sides need it: the rag
layer reasons about hits, and the Qdrant client constructs them from a wire
payload. Putting it under ``rag`` would only flip the violation around and make
``clients`` import ``rag``. ``core`` is the one layer everything may depend on
and which depends on nothing, so it is the only home that creates no cycle.

Nothing here imports a vendor SDK. That is the property worth keeping: the
lexical fallback builds the same objects from a local corpus with no Qdrant
involved, and the retrieval layer stays indifferent to where a hit came from.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SearchHit:
    """A retrieved chunk, flattened out of whatever produced it."""

    text: str
    title: str
    category: str
    document: str
    section: str
    url: str
    updated_at: str
    score: float

    @classmethod
    def from_payload(cls, payload: dict[str, Any] | None, score: float) -> "SearchHit":
        """Build one from a stored point's payload.

        Every field is coerced rather than trusted: a payload written by an
        older indexer, or by the admin ingestion path, may be missing a key that
        the retrieval layer then treats as a plain string.
        """
        payload = payload or {}
        return cls(
            text=str(payload.get("text", "")),
            title=str(payload.get("title", "")),
            category=str(payload.get("category", "")),
            document=str(payload.get("document", "")),
            section=str(payload.get("section", "")),
            url=str(payload.get("url", "")),
            updated_at=str(payload.get("updated_at", "")),
            score=float(score),
        )
