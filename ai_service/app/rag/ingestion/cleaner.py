"""Normalising exported values into prose fragments.

The export is a verbatim dump of JavaScript objects, so a field may arrive as a
string, a number, a list, or absent entirely. These helpers turn any of those
into text a chunk can carry, without the callers below having to check types at
every field access.

Small on purpose. The value is not the code, it is that every builder in
``corpus.py`` treats a missing field the same way instead of each inventing its
own placeholder.
"""

from __future__ import annotations

import re
from typing import Iterable


def _clean(value: object) -> str:
    """Normalise whitespace and the typographic quotes the site's copy uses.

    The curly apostrophes are correct on the page and unhelpful in a search
    index, where a visitor typing a straight quote should still match.
    """
    text = str(value or "").strip()
    text = text.replace("’", "'").replace("‘", "'")
    text = text.replace("“", '"').replace("”", '"')
    text = text.replace("—", " — ").replace(" ", " ")
    return re.sub(r"[ \t]+", " ", text).strip()


def _join(parts: Iterable[str], separator: str = " ") -> str:
    return separator.join(part for part in (p.strip() for p in parts) if part)


def _sentences(text: str) -> list[str]:
    """Split on sentence ends, keeping the terminator attached.

    Good enough for editorial prose, and the fallback below means a passage
    with no sentence breaks at all still gets divided rather than truncated.
    """
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p for p in (part.strip() for part in parts) if p]
