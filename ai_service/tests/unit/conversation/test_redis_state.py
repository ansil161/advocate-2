"""The Redis-backed shared state, and its fallbacks.

Run against ``fakeredis`` rather than a live server so the suite stays runnable
with no infrastructure — the same reason the production code treats Redis as
optional. What is actually being pinned here is not "Redis works" but the three
properties that make it worth introducing:

* the counters are **shared**, so two workers enforce one limit;
* a conversation **survives** the process that started it;
* a Redis failure **degrades** rather than failing a visitor's question.

The third is the one most likely to regress, and the most damaging: an
exception escaping the limiter or the memory store would turn a cache outage
into an outage of the assistant.
"""

from __future__ import annotations

import pytest

from app.conversation.memory import (
    ConversationStore,
    RedisConversationStore,
    build_conversation_store,
)
from app.core.exceptions import RateLimitExceeded
from app.core.rate_limit import RateLimiter, RedisRateLimiter, build_rate_limiter


@pytest.fixture
def redis():
    """An in-memory stand-in with the async Redis interface."""
    import fakeredis.aioredis

    return fakeredis.aioredis.FakeRedis(decode_responses=True)


class _BrokenRedis:
    """Fails every call, the way an unreachable server does mid-request."""

    def pipeline(self, transaction: bool = True):
        raise ConnectionError("redis is gone")

    async def get(self, *args, **kwargs):
        raise ConnectionError("redis is gone")

    async def set(self, *args, **kwargs):
        raise ConnectionError("redis is gone")

    async def delete(self, *args, **kwargs):
        raise ConnectionError("redis is gone")


# ── backend selection ────────────────────────────────────────────────────────


def test_builders_pick_redis_when_available(settings, redis):
    assert isinstance(build_rate_limiter(settings, redis), RedisRateLimiter)
    assert isinstance(build_conversation_store(settings, redis), RedisConversationStore)


def test_builders_fall_back_when_redis_is_absent(settings):
    """No Redis must still produce a working service, not a broken one."""
    assert isinstance(build_rate_limiter(settings, None), RateLimiter)
    assert isinstance(build_conversation_store(settings, None), ConversationStore)


def test_backends_report_themselves(settings, redis):
    """/health surfaces this, so an operator can tell which mode is live."""
    assert build_rate_limiter(settings, redis).backend == "redis"
    assert build_rate_limiter(settings, None).backend == "in-process"


# ── rate limiting ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_redis_limiter_allows_up_to_the_limit_then_blocks(settings, redis):
    limiter = RedisRateLimiter(settings, redis)
    key = RateLimiter.identify("203.0.113.7")

    for _ in range(settings.rate_limit_per_minute):
        await limiter.check(key)

    with pytest.raises(RateLimitExceeded) as excinfo:
        await limiter.check(key)
    assert excinfo.value.retry_after > 0


@pytest.mark.asyncio
async def test_the_limit_is_shared_across_workers(settings, redis):
    """The whole point of moving these counters out of the process.

    Two limiters on one Redis are two worker processes. Between them they must
    allow the configured limit, not twice it.
    """
    worker_a = RedisRateLimiter(settings, redis)
    worker_b = RedisRateLimiter(settings, redis)
    key = RateLimiter.identify("203.0.113.9")

    for n in range(settings.rate_limit_per_minute):
        await (worker_a if n % 2 == 0 else worker_b).check(key)

    with pytest.raises(RateLimitExceeded):
        await worker_b.check(key)


@pytest.mark.asyncio
async def test_redis_limiter_separates_clients(settings, redis):
    limiter = RedisRateLimiter(settings, redis)
    for _ in range(settings.rate_limit_per_minute):
        await limiter.check(RateLimiter.identify("198.51.100.1"))
    # A different caller is unaffected.
    await limiter.check(RateLimiter.identify("198.51.100.2"))


@pytest.mark.asyncio
async def test_counter_keys_carry_a_ttl(settings, redis):
    """Without a TTL the day counter would never reset and would leak keys."""
    limiter = RedisRateLimiter(settings, redis)
    await limiter.check(RateLimiter.identify("198.51.100.3"))

    keys = [k async for k in redis.scan_iter(match="rl:*")]
    assert keys
    for key in keys:
        assert await redis.ttl(key) > 0


@pytest.mark.asyncio
async def test_a_redis_failure_degrades_instead_of_raising(settings):
    """A cache outage must not become an outage of the assistant."""
    limiter = RedisRateLimiter(settings, _BrokenRedis())
    key = RateLimiter.identify("203.0.113.11")

    # Still enforces a limit — the local fallback — rather than either raising a
    # ConnectionError or letting every request through.
    for _ in range(settings.rate_limit_per_minute):
        await limiter.check(key)
    with pytest.raises(RateLimitExceeded):
        await limiter.check(key)


# ── conversation memory ──────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_conversation_survives_a_different_process(settings, redis):
    """A visitor's follow-up may land on any worker."""
    first = RedisConversationStore(settings, redis)
    await first.record("conv-1", "What areas of law?", "Twelve areas.")

    second = RedisConversationStore(settings, redis)
    history = await second.history("conv-1")
    assert [t["content"] for t in history] == ["What areas of law?", "Twelve areas."]


@pytest.mark.asyncio
async def test_redis_history_is_bounded_to_the_window(settings, redis):
    store = RedisConversationStore(settings, redis)
    for n in range(20):
        await store.record("conv-2", f"question {n}", f"answer {n}")

    history = await store.history("conv-2")
    assert len(history) == settings.chat_history_turns * 2
    assert history[-1]["content"] == "answer 19"
    assert "question 0" not in [t["content"] for t in history]


@pytest.mark.asyncio
async def test_conversations_expire(settings, redis):
    """Questions to a law firm are not kept beyond the configured hour."""
    store = RedisConversationStore(settings, redis)
    await store.record("conv-3", "q", "a")
    ttl = await redis.ttl("conv:conv-3")
    assert 0 < ttl <= settings.chat_conversation_ttl_seconds


@pytest.mark.asyncio
async def test_unknown_and_empty_conversations_have_no_history(settings, redis):
    store = RedisConversationStore(settings, redis)
    assert await store.history("neverseen") == []
    assert await store.history(None) == []
    assert await store.history("") == []


@pytest.mark.asyncio
async def test_forget_removes_the_thread(settings, redis):
    store = RedisConversationStore(settings, redis)
    await store.record("conv-4", "q", "a")
    await store.forget("conv-4")
    assert await store.history("conv-4") == []


@pytest.mark.asyncio
async def test_memory_failure_degrades_to_no_history(settings):
    """Losing memory costs context, which is survivable. Raising is not."""
    store = RedisConversationStore(settings, _BrokenRedis())
    await store.record("conv-5", "q", "a")  # must not raise
    assert await store.history("conv-5") == []


@pytest.mark.asyncio
async def test_corrupt_entry_reads_as_no_history(settings, redis):
    """A malformed value starts the conversation over rather than erroring."""
    await redis.set("conv:conv-6", "not json")
    store = RedisConversationStore(settings, redis)
    assert await store.history("conv-6") == []
