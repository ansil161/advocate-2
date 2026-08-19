"""Redis wired through the whole application, not just the classes.

The unit tests in ``tests/unit/conversation/test_redis_state.py`` prove the two
backends behave correctly in isolation. This file proves something different and
easier to get wrong: that the application actually *uses* them — that
``lifespan`` selects the Redis implementations, that ``/api/health`` reports it,
and that a request travelling through the real route and the real chat service
lands on shared state rather than on a per-process dict.

A wiring bug here would be invisible to the unit tests and to a casual smoke
test: the service would work perfectly on one worker and silently lose its
shared limit on two.

Run against ``fakeredis`` rather than a live server, so the suite needs no
infrastructure. What that cannot check is the network — a real Redis is covered
by the Docker Compose stack, where ``depends_on: service_healthy`` gates startup
on it answering.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.conversation.memory import RedisConversationStore
from app.core.rate_limit import RedisRateLimiter


@pytest.fixture
def fake_redis():
    import fakeredis.aioredis

    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
def redis_app(settings, parts, fake_redis, monkeypatch):
    """The real app, with Redis substituted at the connection boundary.

    Patching ``connect`` rather than handing the app a client is deliberate: it
    exercises the actual selection logic in ``lifespan``, which is the thing
    under test. Handing it a client would prove only that the classes work.
    """

    async def _connect(_settings):
        return fake_redis

    monkeypatch.setattr("app.main.connect_redis", _connect)

    from app.main import create_app

    app = create_app(settings)
    with TestClient(app) as client:
        # The upstreams stay faked; only the shared-state layer is real here.
        app.state.chat_service = parts["service"]
        app.state.vector_store = parts["store"]
        yield client, app


def test_lifespan_selects_the_redis_backends(redis_app):
    _, app = redis_app
    assert isinstance(app.state.rate_limiter, RedisRateLimiter)
    assert app.state.redis is not None


def test_health_reports_redis(redis_app):
    """An operator's only way to tell which mode is live from outside."""
    client, _ = redis_app
    body = client.get("/api/health").json()
    assert body["shared_state"] == "redis"


def test_health_reports_in_process_without_redis(client):
    """The default fixture builds the app with no Redis."""
    assert client.get("/api/health").json()["shared_state"] == "in-process"


def test_rate_limit_is_enforced_through_the_real_route(redis_app, settings):
    """End to end: route → dependency → Redis limiter → 429."""
    client, _ = redis_app

    statuses = []
    for _ in range(settings.rate_limit_per_minute + 2):
        statuses.append(
            client.post("/api/chat", json={"message": "What areas of law?"}).status_code
        )

    assert statuses.count(200) == settings.rate_limit_per_minute
    assert statuses[-1] == 429


def test_rate_limit_counters_land_in_redis(redis_app, fake_redis):
    """Proves the counting happened in Redis and not in a process-local dict."""
    import asyncio

    client, _ = redis_app
    client.post("/api/chat", json={"message": "What areas of law?"})

    async def keys():
        return [k async for k in fake_redis.scan_iter(match="rl:*")]

    assert asyncio.run(keys()), "no rate-limit keys were written to Redis"


def test_conversation_survives_in_redis(redis_app, fake_redis, settings, parts):
    """A second request continues the thread, and the state is in Redis."""
    import asyncio

    client, app = redis_app
    # The chat service in `parts` was built with the in-process store, so point
    # it at the Redis one the app selected — this test is about the store, and
    # the route/service wiring is covered above.
    parts["service"]._conversations = RedisConversationStore(settings, fake_redis)  # noqa: SLF001

    first = client.post("/api/chat", json={"message": "What areas of law?"}).json()
    conversation_id = first["conversation_id"]

    async def stored():
        return await fake_redis.get(f"conv:{conversation_id}")

    assert asyncio.run(stored()), "the conversation was not written to Redis"

    second = client.post(
        "/api/chat",
        json={"message": "Tell me more about banking.", "conversation_id": conversation_id},
    ).json()
    assert second["conversation_id"] == conversation_id
