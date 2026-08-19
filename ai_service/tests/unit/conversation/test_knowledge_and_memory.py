"""The corpus, conversation memory, rate limiting, and lexical retrieval."""

from __future__ import annotations

import pytest

from app.core.exceptions import RateLimitExceeded
from app.core.rate_limit import RateLimiter
from app.rag.ingestion.chunker import MAX_CHUNK_CHARS, split_body
from app.rag.ingestion.corpus import build_chunks
from app.conversation.memory import ConversationStore
from app.rag.retrieval.keyword import LexicalIndex
from app.conversation.rewriter import build_search_query


# ── corpus ───────────────────────────────────────────────────────────────────


def test_corpus_covers_every_content_family(chunks):
    categories = {c.category for c in chunks}
    assert categories == {
        "firm",
        "practice-area",
        "faq",
        "team",
        "industry",
        "recognition",
        "matter",
        "contact",
    }


def test_chunk_ids_are_stable_across_builds():
    first = {c.key: c.id for c in build_chunks()}
    second = {c.key: c.id for c in build_chunks()}
    assert first == second
    assert len(set(first.values())) == len(first)


def test_chunks_fit_the_embedding_window(chunks):
    # Header and keyword line are added on top of the split body, so the
    # ceiling is the body limit plus that overhead rather than MAX_CHUNK_CHARS.
    assert all(len(c.text) <= MAX_CHUNK_CHARS + 300 for c in chunks)


def test_every_chunk_carries_a_source_url(chunks):
    assert all(c.url.startswith("/") for c in chunks)


def test_every_split_part_repeats_its_heading(chunks):
    multi = [c for c in chunks if "part 1 of" in c.text or "part 2 of" in c.text]
    assert multi, "expected at least one document long enough to split"
    for chunk in multi:
        # The first line is the header, and it names the subject.
        assert chunk.text.splitlines()[0].strip()


def test_illustrative_matters_always_carry_their_disclaimer(chunks):
    matters = [c for c in chunks if c.category == "matter"]
    assert matters
    for chunk in matters:
        assert "not verifiable case citations" in chunk.text


def test_real_firm_facts_are_present_verbatim(chunks):
    corpus = "\n".join(c.text for c in chunks)
    # Sourced facts that must survive the pipeline unaltered.
    assert "TS/286/1996" in corpus
    assert "Sridhar Lendalay" in corpus
    assert "2013" in corpus
    assert "Debt Recovery Tribunal (DRT)" in corpus


def test_split_body_respects_the_limit():
    body = ". ".join(f"Sentence number {n} about the firm" for n in range(120))
    parts = split_body(body, max_chars=300, overlap=40)
    assert len(parts) > 1
    assert all(len(p) <= 300 for p in parts)


def test_split_body_handles_one_unbroken_run():
    parts = split_body("x" * 2000, max_chars=300, overlap=40)
    assert parts
    assert all(len(p) <= 300 for p in parts)


# ── lexical retrieval ────────────────────────────────────────────────────────


def test_lexical_index_finds_the_right_practice_area(chunks):
    index = LexicalIndex(chunks)
    hits = index.search("SARFAESI DRT recovery for a bank", limit=3)
    assert hits
    assert any("Banking" in h.section or "banking" in h.text.lower() for h in hits)


def test_lexical_index_finds_an_advocate_by_name(chunks):
    index = LexicalIndex(chunks)
    hits = index.search("Palanati Lakshman", limit=3)
    assert hits
    assert "Palanati Lakshman" in hits[0].text


@pytest.mark.parametrize(
    "query",
    [
        "capital city of brazil football",
        "what is the weather in paris tomorrow",
        # "court" and "case" both occur throughout the corpus; on their own they
        # must not be enough to pull an answer out of it.
        "who won the cricket world court case in australia",
        "write me a python script",
    ],
)
def test_lexical_index_declines_off_topic_queries(chunks, query):
    """Regression: one incidental word must not produce a confident match.

    "capital city of brazil football" used to return the Banking practice area
    at a normalised score of 1.0, because "city" appears in "City Civil Courts"
    and dividing the best score by itself always yields 1.0. Term coverage is
    what closes that hole.
    """
    index = LexicalIndex(chunks)
    assert index.search(query, limit=5) == []


def test_lexical_index_still_answers_real_questions(chunks):
    """The coverage rule must not be so strict that it breaks ordinary asks."""
    index = LexicalIndex(chunks)
    for query in (
        "What areas of law does SLA handle?",
        "who founded the firm",
        "bail application",
        "how do I contact SLA Advocates",
        "SARFAESI DRT recovery for a bank",
    ):
        assert index.search(query, limit=3), f"expected a hit for {query!r}"


def test_lexical_scores_are_normalised(chunks):
    index = LexicalIndex(chunks)
    hits = index.search("banking recovery", limit=5)
    assert hits[0].score == 1.0
    assert all(0 < h.score <= 1.0 for h in hits)


# ── query building ───────────────────────────────────────────────────────────


def test_short_follow_up_inherits_the_previous_question():
    history = [
        {"role": "user", "content": "What areas of law does SLA handle?"},
        {"role": "assistant", "content": "Twelve areas."},
    ]
    query = build_search_query("Tell me more about banking", history)
    assert "What areas of law" in query and "banking" in query


def test_long_questions_are_not_diluted_with_history():
    history = [{"role": "user", "content": "Something entirely unrelated about probate"}]
    question = (
        "Could you explain in detail how the firm approaches SARFAESI enforcement "
        "on behalf of an institutional lender pursuing a non-performing asset?"
    )
    assert build_search_query(question, history) == question


# ── conversation memory ──────────────────────────────────────────────────────


async def test_history_is_bounded_to_the_configured_window(settings):
    store = ConversationStore(settings)
    for n in range(20):
        await store.record("abc123", f"question {n}", f"answer {n}")

    history = await store.history("abc123")
    assert len(history) == settings.chat_history_turns * 2
    assert history[-1]["content"] == "answer 19"
    assert "question 0" not in [turn["content"] for turn in history]


async def test_unknown_conversation_has_no_history(settings):
    assert await ConversationStore(settings).history("neverseen") == []
    assert await ConversationStore(settings).history(None) == []


async def test_store_evicts_least_recently_used(settings):
    store = ConversationStore(settings, max_conversations=3)
    for cid in ("a1", "b2", "c3", "d4"):
        await store.record(cid, "q", "a")
    assert len(store) == 3
    assert await store.history("a1") == []


async def test_expired_conversations_are_forgotten(settings):
    settings.chat_conversation_ttl_seconds = 60
    store = ConversationStore(settings)
    await store.record("abc123", "q", "a")
    # Reach into the entry rather than sleeping for a minute.
    store._items["abc123"].updated_at -= 120  # noqa: SLF001
    assert await store.history("abc123") == []


# ── rate limiting ────────────────────────────────────────────────────────────


async def test_limiter_allows_up_to_the_limit_then_blocks(settings):
    limiter = RateLimiter(settings)
    key = RateLimiter.identify("203.0.113.7")

    for _ in range(settings.rate_limit_per_minute):
        await limiter.check(key)

    with pytest.raises(RateLimitExceeded) as excinfo:
        await limiter.check(key)
    assert excinfo.value.retry_after > 0


def test_limiter_keys_are_hashed_not_raw_addresses():
    key = RateLimiter.identify("203.0.113.7")
    assert "203.0.113.7" not in key
    assert len(key) == 16
    assert key == RateLimiter.identify("203.0.113.7")
    assert key != RateLimiter.identify("203.0.113.8")


async def test_limiter_separates_clients(settings):
    limiter = RateLimiter(settings)
    for _ in range(settings.rate_limit_per_minute):
        await limiter.check(RateLimiter.identify("198.51.100.1"))
    # A different caller is unaffected.
    await limiter.check(RateLimiter.identify("198.51.100.2"))


async def test_limiter_bounds_the_clients_it_tracks(settings):
    limiter = RateLimiter(settings, max_clients=10)
    for n in range(50):
        await limiter.check(RateLimiter.identify(f"10.0.0.{n}"))
    assert len(limiter._clients) <= 10  # noqa: SLF001
