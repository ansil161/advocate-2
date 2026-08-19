"""The internal indexing API: its auth gate, and how admin content is chunked.

The gate is the interesting half. This endpoint can rewrite the firm's
knowledge base, it is not behind a visitor session, and it is reachable by
anything that can route to the service — so "is the secret checked, and does an
unset secret close it rather than open it" is the test that matters most.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.rag.ingestion.admin_chunker import build_admin_chunks
from app.main import create_app

PAYLOAD = {
    "document_id": "42",
    "version": 1,
    "title": "Fee policy",
    "content": "Fees are agreed in writing before work begins.",
    "category": "policy",
    "slug": "fee-policy",
}


@pytest.fixture
def keyed_client(settings):
    """A client whose service has an internal key configured."""
    app = create_app(settings.model_copy(update={"internal_api_key": "test-internal-secret"}))
    with TestClient(app) as client:
        yield client


def test_missing_key_is_rejected(keyed_client):
    response = keyed_client.post("/internal/knowledge/index", json=PAYLOAD)
    assert response.status_code == 401


def test_wrong_key_is_rejected(keyed_client):
    response = keyed_client.post(
        "/internal/knowledge/index", json=PAYLOAD, headers={"X-Internal-Key": "not-the-secret"}
    )
    assert response.status_code == 401


def test_unconfigured_secret_closes_the_endpoint(settings):
    """An unset secret must NOT mean "no check". The default is closed."""
    app = create_app(settings.model_copy(update={"internal_api_key": ""}))
    with TestClient(app) as client:
        response = client.post(
            "/internal/knowledge/index", json=PAYLOAD, headers={"X-Internal-Key": "anything"}
        )
    assert response.status_code == 503


def test_delete_is_gated_too(keyed_client):
    assert keyed_client.delete("/internal/knowledge/42").status_code == 401


def test_malformed_payload_is_rejected_after_auth(keyed_client):
    response = keyed_client.post(
        "/internal/knowledge/index",
        json={"document_id": "42"},
        headers={"X-Internal-Key": "test-internal-secret"},
    )
    assert response.status_code == 422


# ── chunking ─────────────────────────────────────────────────────────────────


def test_every_chunk_carries_the_title():
    """A chunk is retrieved alone; without its heading a fact loses its subject."""
    chunks = build_admin_chunks(
        document_id="7", version=2, title="Fee policy",
        content="Sentence one. " * 200, category="policy", slug="fee-policy",
    )
    assert len(chunks) > 1
    assert all(chunk.text.startswith("Fee policy") for chunk in chunks)


def test_chunk_ids_are_deterministic():
    """Reindexing must overwrite the same points, not accumulate a second copy."""
    kwargs = dict(
        document_id="7", version=1, title="T", content="Body.", category="faq", slug="t"
    )
    assert [c.id for c in build_admin_chunks(**kwargs)] == [c.id for c in build_admin_chunks(**kwargs)]


def test_a_new_version_produces_different_ids():
    base = dict(document_id="7", title="T", content="Body.", category="faq", slug="t")
    first = build_admin_chunks(version=1, **base)[0]
    second = build_admin_chunks(version=2, **base)[0]
    assert first.id != second.id


def test_payload_marks_origin_and_document():
    """Both fields are what make delete-by-filter safe against the site corpus."""
    payload = build_admin_chunks(
        document_id="7", version=3, title="T", content="Body.", category="faq", slug="t"
    )[0].payload()
    assert payload["source"] == "admin"
    assert payload["document_id"] == "7"
    assert payload["version"] == 3
    assert payload["text"] and payload["category"] == "faq"


def test_empty_content_produces_no_chunks():
    assert build_admin_chunks(
        document_id="7", version=1, title="T", content="   ", category="faq", slug="t"
    ) == []
