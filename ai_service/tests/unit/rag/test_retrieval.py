"""Fusion, confidence and context selection.

These are the parts that decide what the model is allowed to see, so the tests
are mostly about what gets *excluded* — the ranking equivalent of the grounding
rules in the prompt.
"""

from __future__ import annotations

import pytest

from app.rag.confidence.scorer import Confidence, assess
from app.rag.context.builder import build_context
from app.rag.retrieval.rrf import FusedHit, reciprocal_rank_fusion
from app.rag.retrieval.reranker import NoOpReranker, parse_scores
from tests.conftest import make_hit


def hit(text: str, *, score: float = 0.8, document: str = "Practice Areas", section: str = "Index"):
    return make_hit(text=text, score=score, document=document, section=section)


# ── Reciprocal rank fusion ───────────────────────────────────────────────────


def test_chunk_found_by_both_branches_outranks_one_found_by_either():
    """The core reason hybrid retrieval is worth the complexity."""
    both = hit("found by both")
    vector_only = hit("vector only")
    keyword_only = hit("keyword only")

    fused = reciprocal_rank_fusion(
        [vector_only, both],   # keyword_only absent from this branch
        [keyword_only, both],  # vector_only absent from this one
    )
    assert fused[0].hit.text == "found by both"
    assert fused[0].found_by_both
    assert fused[0].branches == 2


def test_original_scores_and_ranks_survive_fusion():
    """Confidence needs the absolute cosine; RRF alone cannot supply it."""
    a = hit("alpha", score=0.91)
    fused = reciprocal_rank_fusion([a], [a])
    entry = fused[0]
    assert entry.vector_score == pytest.approx(0.91)
    assert entry.keyword_score == pytest.approx(0.91)
    assert entry.vector_rank == 1 and entry.keyword_rank == 1
    assert entry.rrf_score > 0


def test_duplicate_chunks_are_merged_not_repeated():
    a = hit("same text")
    fused = reciprocal_rank_fusion([a], [a])
    assert len(fused) == 1


def test_limit_truncates_the_candidate_list():
    hits = [hit(f"chunk {i}") for i in range(10)]
    assert len(reciprocal_rank_fusion(hits, [], limit=4)) == 4


def test_empty_branches_fuse_to_nothing():
    assert reciprocal_rank_fusion([], []) == []


def test_one_dead_branch_still_returns_the_other():
    fused = reciprocal_rank_fusion([], [hit("keyword survivor")])
    assert len(fused) == 1
    assert fused[0].branches == 1
    assert fused[0].vector_score is None


# ── Confidence ───────────────────────────────────────────────────────────────


def test_no_hits_is_low(settings):
    assert assess([], settings).level is Confidence.LOW


def test_below_threshold_is_low_and_unanswerable(settings):
    weak = reciprocal_rank_fusion([hit("weak", score=0.40)], [])
    verdict = assess(weak, settings)
    assert verdict.level is Confidence.LOW
    assert not verdict.answerable


def test_strong_corroborated_match_is_high(settings):
    strong = hit("strong match", score=0.82)
    verdict = assess(reciprocal_rank_fusion([strong], [strong]), settings)
    assert verdict.level is Confidence.HIGH
    assert verdict.corroborated


def test_strong_but_single_source_is_only_medium(settings):
    """One good chunk can be luck; HIGH requires independent support."""
    lone = reciprocal_rank_fusion([hit("lone strong", score=0.82)], [])
    verdict = assess(lone, settings)
    assert verdict.level is Confidence.MEDIUM
    assert verdict.answerable


def test_two_distinct_documents_count_as_support(settings):
    a = hit("from practice", score=0.80, document="Practice Areas")
    b = hit("from team", score=0.79, document="Team")
    verdict = assess(reciprocal_rank_fusion([a, b], []), settings)
    assert verdict.level is Confidence.HIGH
    assert verdict.documents == 2


def test_keyword_only_retrieval_stays_answerable(settings):
    """Regression: BM25 scores are ordinal, so the cosine threshold must not apply.

    Judging them on the cosine scale rejected every hit and turned the working
    degraded mode into "I don't have that information".
    """
    verdict = assess(reciprocal_rank_fusion([], [hit("keyword hit", score=1.0)]), settings)
    assert verdict.answerable
    assert verdict.level is Confidence.MEDIUM
    assert "keyword-only" in verdict.reason


def test_keyword_only_never_claims_high(settings):
    many = [hit(f"kw {i}", score=1.0, document=f"Doc{i}") for i in range(5)]
    assert assess(reciprocal_rank_fusion([], many), settings).level is Confidence.MEDIUM


# ── Context builder ──────────────────────────────────────────────────────────


def test_one_document_cannot_monopolise_the_context(settings):
    """Five chunks of one profile must not crowd out the page that answers it."""
    profile = [hit(f"profile part {i} " + "x" * 200, score=0.9, document="Team") for i in range(5)]
    other = hit("the index page " + "y" * 200, score=0.7, document="Practice Areas")
    built = build_context(reciprocal_rank_fusion(profile + [other], []), settings)

    assert built.documents == 2, "the lower-scoring document must still be represented"
    from_team = [h for h in built.hits if h.hit.document == "Team"]
    assert len(from_team) <= settings.rag_max_chunks_per_document


def test_near_duplicate_chunks_are_dropped(settings):
    """Chunks overlap by design, so neighbours share text without being identical.

    Identical text is already merged by fusion's dedup key, so what reaches the
    builder is the *near*-duplicate case: the same sentences with a little new
    material either side.
    """
    shared = " ".join(f"word{i}" for i in range(60))
    a = hit(f"{shared} tail alpha", score=0.9, document="A")
    b = hit(f"head beta {shared}", score=0.85, document="B")
    built = build_context(reciprocal_rank_fusion([a, b], []), settings)
    assert len(built.hits) == 1
    assert built.dropped_duplicate >= 1


def test_single_document_candidates_bypass_the_cap(settings):
    """Nothing to crowd out, so a whole profile stays available."""
    profile = [hit(f"part {i}", score=0.9, document="Team") for i in range(5)]
    built = build_context(reciprocal_rank_fusion(profile, []), settings)
    assert len(built.hits) == 5


def test_context_respects_the_character_budget(settings):
    tight = settings.model_copy(update={"rag_max_context_chars": 500, "rag_max_chunks_per_document": 10})
    hits = [hit("z" * 400 + f" {i}", score=0.9, document=f"Doc{i}") for i in range(5)]
    built = build_context(reciprocal_rank_fusion(hits, []), tight)
    assert built.used_chars <= 500
    assert len(built.hits) < 5


def test_best_match_is_kept_first(settings):
    best = hit("the best one", score=0.95, document="A")
    worse = hit("a worse one", score=0.62, document="B")
    built = build_context(reciprocal_rank_fusion([best, worse], []), settings)
    assert built.hits[0].hit.text == "the best one"


# ── Reranker parsing ─────────────────────────────────────────────────────────


def test_scores_parse_from_clean_json():
    assert parse_scores('[{"i":1,"s":9},{"i":2,"s":3}]', 2) == {1: 0.9, 2: 0.3}


def test_scores_parse_despite_surrounding_prose():
    raw = 'Sure! Here you go:\n```json\n[{"i":1,"s":10}]\n```\nHope that helps.'
    assert parse_scores(raw, 1) == {1: 1.0}


def test_out_of_range_indices_are_dropped_not_clamped():
    """A model inventing passage 47 is confused; remapping it would corrupt the ranking."""
    assert parse_scores('[{"i":47,"s":9},{"i":1,"s":5}]', 2) == {1: 0.5}


def test_scores_are_clamped_into_range():
    assert parse_scores('[{"i":1,"s":99},{"i":2,"s":-4}]', 2) == {1: 1.0, 2: 0.0}


def test_missing_json_raises():
    with pytest.raises(ValueError):
        parse_scores("I could not do that.", 3)


@pytest.mark.asyncio
async def test_noop_reranker_preserves_order():
    hits = reciprocal_rank_fusion([hit("a"), hit("b")], [])
    assert await NoOpReranker().rerank("q", hits) == hits
