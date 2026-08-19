"""HTTP-level behaviour: validation, limits, and what a failure looks like."""

from __future__ import annotations

import pytest

from tests.conftest import make_hit


def test_opening_needs_no_upstreams(client):
    body = client.get("/api/chat/opening").json()
    assert body["greeting"].startswith("Welcome to SLA Advocates")
    assert len(body["suggested_questions"]) >= 3


def test_valid_request_returns_grounded_answer(client, parts):
    parts["store"].hits = [make_hit()]
    response = client.post("/api/chat", json={"message": "What areas of law does SLA handle?"})

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "generated"
    assert body["answer"] == "The firm handles twelve areas of law."
    # Hybrid retrieval, so the vector hit arrives alongside whatever the keyword
    # branch corroborated it with — asserting an exact single-element list here
    # would be asserting that fusion did not happen.
    assert {"title": "Practice Areas", "section": "Index", "url": "/practice"} in body["sources"]
    assert all({"title", "section", "url"} == set(source) for source in body["sources"])
    assert len(body["conversation_id"]) == 32
    # No cache may hold a reply that depends on conversation state.
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-request-id"]


@pytest.mark.parametrize(
    "payload",
    [
        {"message": ""},
        {"message": "   "},
        {"message": "x" * 1001},
        {"message": "hi", "conversation_id": "not-an-id"},
        {"message": "hi", "conversation_id": "../../etc/passwd"},
        {"message": "hi", "extra": "field"},
        {"conversation_id": "abcdef12"},
        {"message": ["not", "a", "string"]},
    ],
)
def test_invalid_requests_are_rejected(client, payload):
    assert client.post("/api/chat", json=payload).status_code == 422


def test_validation_errors_do_not_echo_input_or_schema(client):
    # The default FastAPI handler would return the field path, the rule, and
    # the offending value — which here would be the visitor's own text.
    secret = "zzz-unique-marker-zzz"
    response = client.post("/api/chat", json={"message": secret * 200})

    assert response.status_code == 422
    raw = response.text
    assert secret not in raw
    assert "loc" not in raw and "ctx" not in raw
    assert response.json() == {
        "error": {"code": "invalid_request", "message": "That message couldn't be sent. Please try rephrasing it."}
    }


def test_oversized_body_rejected_before_parsing(client):
    response = client.post(
        "/api/chat",
        content=b'{"message":"' + b"x" * 20_000 + b'"}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_rate_limit_returns_429_with_retry_after(client, parts):
    parts["store"].hits = [make_hit()]
    limit = parts["settings"].rate_limit_per_minute

    for _ in range(limit):
        assert client.post("/api/chat", json={"message": "hello"}).status_code == 200

    blocked = client.post("/api/chat", json={"message": "hello"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) > 0
    # The visitor is told to wait, not told what the limit is or how it works.
    assert "limit of" not in blocked.text


def test_health_reports_degraded_rather_than_failing(client):
    body = client.get("/api/health").json()
    assert body["status"] in {"ok", "degraded"}
    assert body["knowledge_chunks"] > 0


def test_cors_allows_the_site_and_nothing_else(client):
    allowed = client.options(
        "/api/chat",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    denied = client.options(
        "/api/chat",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers
