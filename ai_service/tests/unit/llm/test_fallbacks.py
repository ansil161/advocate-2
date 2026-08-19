"""The fallback chain — the part of this service most worth testing.

Each test below removes one upstream and asserts the assistant degrades to the
next layer rather than failing or, far worse, answering anyway.
"""

from __future__ import annotations

import pytest

from app.core import messages as canned
from tests.conftest import make_hit

pytestmark = pytest.mark.asyncio


async def test_normal_path_generates(parts):
    parts["store"].hits = [make_hit()]
    result = await parts["service"].answer("What areas of law does the firm handle?")

    assert result.mode == "generated"
    assert result.degraded is False
    assert result.sources


async def test_embedding_failure_falls_back_to_lexical(parts):
    parts["embedder"].fail = True
    result = await parts["service"].answer("What areas of law does the firm handle?")

    # Still a composed answer, still attributed — the corpus is the same, only
    # the way it was searched has changed.
    assert result.mode == "generated"
    assert result.degraded is True
    assert result.sources


async def test_vector_store_failure_falls_back_to_lexical(parts):
    parts["store"].fail = True
    result = await parts["service"].answer("Who founded SLA Advocates?")

    assert result.degraded is True
    assert result.sources


async def test_generation_failure_quotes_the_source(parts):
    parts["store"].hits = [make_hit(text="Heading line\nSLA Advocates practises across 12 areas of law.")]
    parts["llm"].fail = True

    result = await parts["service"].answer("What areas of law does the firm handle?")

    assert result.mode == "quoted"
    assert result.degraded is True
    assert result.answer.startswith(canned.QUOTE_PREFIX)
    # The firm's own words survive; the chunk's retrieval heading does not.
    assert "SLA Advocates practises across 12 areas of law." in result.answer
    assert "Heading line" not in result.answer


async def test_everything_down_still_answers_from_the_corpus(parts):
    parts["embedder"].fail = True
    parts["llm"].fail = True

    result = await parts["service"].answer("What areas of law does the firm handle?")

    assert result.mode == "quoted"
    assert result.answer
    assert result.sources


async def test_no_relevant_context_declines_instead_of_guessing(parts):
    # Nothing in the store, and nothing lexical will match this either.
    parts["store"].hits = []
    result = await parts["service"].answer("What is the capital of Brazil?")

    assert result.mode == "no_context"
    assert result.answer == canned.NO_CONTEXT
    assert result.sources == []
    # The model is never even asked.
    assert parts["llm"].seen == []


async def test_below_threshold_hits_are_discarded(parts):
    # The store applies the configured threshold, so a weak match returns
    # nothing rather than the corpus' least-bad answer.
    parts["store"].hits = [make_hit(score=0.05)]
    result = await parts["service"].answer("zzzqqq unrelated gibberish token")

    assert result.mode == "no_context"


async def test_suggestions_are_offered_even_when_declining(parts):
    parts["store"].hits = []
    result = await parts["service"].answer("What is the capital of Brazil?")

    assert result.suggested_questions
    assert all(isinstance(q, str) and q for q in result.suggested_questions)
