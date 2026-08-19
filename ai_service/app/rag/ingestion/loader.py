"""Reading the generated knowledge export.

The corpus is authored in the website's own ``client/src/data/*.js`` and dumped
verbatim to ``data/knowledge.json`` by ``npm run knowledge``. Nothing in this
service edits that file, and no firm fact is ever hand-written on the Python
side — a second copy of an enrolment number would drift, and a stale number on
a law firm's site is not cosmetic.

Separated from chunking so that "where does the data come from" and "how is it
cut up" are answered in different files. They change for different reasons: the
first changes when the deployment layout changes, the second when retrieval
quality needs tuning.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Generated data lives outside the source tree, at the service root, so that
# `app/` contains only code. parents[3] walks up from
# app/rag/ingestion/loader.py to the service root.
DATA_FILE = Path(__file__).resolve().parents[3] / "data" / "knowledge.json"


def load_payload(path: Path | None = None) -> dict[str, Any]:
    """Read the exported knowledge file.

    Raises rather than returning empty: an assistant that silently starts up
    with no corpus would answer every question with the "no information"
    fallback and look merely unhelpful instead of broken.
    """
    source = path or DATA_FILE
    if not source.exists():
        raise FileNotFoundError(
            f"Knowledge export not found at {source}. Run `npm run knowledge` in client/ to generate it."
        )
    return json.loads(source.read_text(encoding="utf-8"))
