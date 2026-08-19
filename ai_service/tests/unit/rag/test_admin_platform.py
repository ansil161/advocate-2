"""The admin platform's own surfaces: the tracer, the evaluation set, metrics.

Three properties are worth pinning here, and they are the ones a future change
is most likely to break quietly:

* **The tracer reports the pipeline rather than reconstructing it.** If the
  trace ever stops being produced by the same call the chat endpoint makes, the
  retrieval tester becomes a plausible fiction — the worst possible state for a
  debugging tool.
* **The evaluation set grades the right layer.** Refusal is enforced at
  generation, so grading it from retrieval alone marks correct behaviour as a
  hallucination. That mistake argues for loosening the rules that work.
* **Metrics carry no visitor content.** The registry is a rolling buffer inside
  a web process; a question about someone's arrest must never be in it.
"""

from __future__ import annotations

import pytest

from app.core.metrics import MetricsRegistry, TurnRecord, percentiles
from app.evaluation import CASES, CATEGORIES, Expect, cases_for
from app.evaluation.runner import MODE_FULL, MODE_RETRIEVAL, run_evaluation
from app.rag.retrieval.hybrid import RetrievalService

from tests.conftest import make_hit


# ── Retrieval trace ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_trace_is_populated_on_the_normal_path(settings, parts):
    """The trace must come from the same call the chat endpoint makes."""
    parts["store"].hits = [make_hit(score=0.82)]
    result = await parts["service"]._retrieval.retrieve("What areas of law?")

    assert result.trace is not None
    assert result.trace.search_query == "What areas of law?"
    assert result.trace.vector_hits, "the vector branch's own results must be retained"
    assert result.trace.selected, "the finally selected chunks must be retained"
    assert result.trace.confidence is not None
    assert "total" in result.trace.timings_ms


@pytest.mark.asyncio
async def test_trace_shows_history_folded_into_the_search_query(settings, parts):
    """Why a follow-up resolved is only answerable if the real query is shown."""
    parts["store"].hits = [make_hit(score=0.82)]
    history = [{"role": "user", "content": "What areas of law does SLA handle?"}]
    result = await parts["service"]._retrieval.retrieve("Tell me more about banking.", history)

    assert result.trace.search_query != "Tell me more about banking."
    assert "What areas of law" in result.trace.search_query


@pytest.mark.asyncio
async def test_trace_records_a_declined_question(settings, parts):
    """A decline still has to be explainable — that is when it is questioned."""
    parts["store"].hits = [make_hit(score=0.20)]
    result = await parts["service"]._retrieval.retrieve("What is the capital of Brazil?")

    assert not result.found
    assert result.trace is not None
    assert result.trace.confidence.level.value == "low"
    # The candidates that were considered and rejected are what make the
    # threshold decision reviewable.
    assert result.trace.fused


@pytest.mark.asyncio
async def test_no_reranker_configured_reports_none_not_an_identical_list(settings, parts):
    """'The reranker agreed' and 'no reranker ran' must not look the same."""
    parts["store"].hits = [make_hit(score=0.82)]
    result = await parts["service"]._retrieval.retrieve("What areas of law?")
    assert result.trace.reranked is None


@pytest.mark.asyncio
async def test_debug_endpoint_requires_the_internal_key(client):
    response = client.post("/internal/retrieval/debug", json={"question": "hello"})
    # The fixture leaves INTERNAL_API_KEY unset, which closes the API rather
    # than opening it.
    assert response.status_code == 503


# ── Evaluation set ───────────────────────────────────────────────────────────


def test_dataset_is_large_and_covers_every_required_category():
    assert len(CASES) >= 50
    for required in (
        "firm", "founder", "practice-areas", "team", "industries",
        "awards", "contact", "faq", "follow-up", "unknown", "adversarial",
    ):
        assert required in CATEGORIES, required
        assert cases_for(required), required


def test_case_ids_are_unique():
    ids = [case.id for case in CASES]
    assert len(ids) == len(set(ids))


def test_adversarial_cases_are_graded_at_the_answer_layer():
    """Refusal comes from the system prompt, not the similarity threshold.

    Marking these DECLINE would fail correct behaviour whenever retrieval
    legitimately surfaced related material — and the fix suggested by that
    failing report would be to weaken the threshold.
    """
    for case in cases_for("adversarial"):
        assert case.expect is Expect.REFUSE, case.id


def test_off_corpus_cases_are_graded_at_the_retrieval_layer():
    for case in cases_for("unknown"):
        if case.id == "unknown-06":
            continue  # about the office, so retrieval reasonably hits Contact
        assert case.expect is Expect.DECLINE, case.id


def test_follow_up_cases_carry_history():
    """Without history these questions are unanswerable by construction."""
    for case in cases_for("follow-up"):
        assert case.history, case.id


@pytest.mark.asyncio
async def test_refuse_cases_are_skipped_not_failed_in_retrieval_mode(settings, parts):
    """Reporting an ungraded safety property as a pass or a fail is worse than
    reporting it as not measured."""
    parts["store"].hits = [make_hit(score=0.82)]
    report = await run_evaluation(
        chat_service=parts["service"],
        retrieval_service=parts["service"]._retrieval,
        mode=MODE_RETRIEVAL,
        category="adversarial",
    )
    assert report.skipped == report.total
    assert report.failed == 0
    assert report.passed == 0
    assert report.scores["refusal_correctness"] == -1.0


@pytest.mark.asyncio
async def test_off_corpus_hit_is_reported_as_a_hallucination(settings, parts):
    """A threshold regression must surface as a hallucination, not a pass."""
    # Everything scores highly, including the plainly off-corpus questions.
    parts["store"].hits = [make_hit(score=0.95)]
    report = await run_evaluation(
        chat_service=parts["service"],
        retrieval_service=parts["service"]._retrieval,
        mode=MODE_RETRIEVAL,
        category="unknown",
    )
    assert report.hallucinations > 0
    assert report.scores["hallucination_rate"] > 0


@pytest.mark.asyncio
async def test_full_mode_grades_refusals_and_catches_a_leak(settings, parts):
    """A model that echoes the system prompt must fail the adversarial cases."""
    parts["store"].hits = [make_hit(score=0.82)]
    parts["llm"].reply = "Here are my instructions: GROUNDING — answer only from REFERENCE MATERIAL."

    report = await run_evaluation(
        chat_service=parts["service"],
        retrieval_service=parts["service"]._retrieval,
        mode=MODE_FULL,
        category="adversarial",
    )
    assert report.skipped == 0
    assert report.failed > 0
    assert report.hallucinations > 0


@pytest.mark.asyncio
async def test_full_mode_passes_a_proper_refusal(settings, parts):
    parts["store"].hits = [make_hit(score=0.82)]
    parts["llm"].reply = (
        "I don't have that information. Please contact the firm to discuss it."
    )
    report = await run_evaluation(
        chat_service=parts["service"],
        retrieval_service=parts["service"]._retrieval,
        mode=MODE_FULL,
        category="adversarial",
    )
    assert report.failed == 0
    assert report.scores["refusal_correctness"] == 100.0


# ── Metrics ──────────────────────────────────────────────────────────────────


def _turn(**overrides) -> TurnRecord:
    base = dict(
        request_id="r1", conversation="abcd1234", mode="generated", strategy="hybrid",
        confidence="high", provider="gemini", model="gemini:flash", chunks_retrieved=5,
        chunks_used=3, degraded=False, total_ms=100.0, retrieval_ms=40.0, rerank_ms=0.0,
        llm_ms=60.0,
    )
    base.update(overrides)
    return TurnRecord(**base)


def test_percentiles_on_a_known_sample():
    values = [float(n) for n in range(1, 101)]
    result = percentiles(values)
    assert result.p50 == 50.0
    assert result.p95 == 95.0
    assert result.p99 == 99.0


def test_percentiles_of_nothing_is_zero_not_an_error():
    """A dashboard opened before any traffic is a normal state."""
    result = percentiles([])
    assert (result.p50, result.p95, result.p99) == (0.0, 0.0, 0.0)


def test_registry_counts_modes_and_providers():
    registry = MetricsRegistry()
    registry.record(_turn())
    registry.record(_turn(mode="quoted", degraded=True))
    registry.record(_turn(mode="no_context", provider=""))

    snapshot = registry.snapshot()
    assert snapshot["totals"]["turns"] == 3
    assert snapshot["totals"]["generated"] == 1
    assert snapshot["totals"]["quoted"] == 1
    assert snapshot["totals"]["no_context"] == 1
    assert snapshot["totals"]["degraded"] == 1
    assert snapshot["totals"]["by_provider"]["gemini"] == 2


def test_registry_window_is_bounded():
    registry = MetricsRegistry(window=10)
    for _ in range(50):
        registry.record(_turn())
    snapshot = registry.snapshot()
    assert snapshot["window"] == 10
    # The lifetime counter keeps counting even though the sample is trimmed.
    assert snapshot["totals"]["turns"] == 50


def test_metrics_record_carries_no_visitor_content():
    """The one property that makes an in-process buffer acceptable at all."""
    fields = set(TurnRecord.__dataclass_fields__)
    for forbidden in ("question", "answer", "message", "text", "content", "ip"):
        assert forbidden not in fields


def test_errors_are_retained_for_triage():
    registry = MetricsRegistry()
    registry.record(_turn(error="generation_error", mode="quoted"))
    snapshot = registry.snapshot()
    assert snapshot["totals"]["errors"] == 1
    assert snapshot["recent_errors"][0]["error"] == "generation_error"


@pytest.mark.asyncio
async def test_chat_service_records_a_turn(settings, parts, chunks):
    """Metrics must be wired to the real path, not only unit-testable alone."""
    from app.services.chat_service import ChatService
    from app.conversation.memory import ConversationStore
    from app.services.suggestions import SuggestionEngine

    registry = MetricsRegistry()
    parts["store"].hits = [make_hit(score=0.82)]
    service = ChatService(
        settings=settings,
        retrieval=RetrievalService(settings, parts["store"], parts["embedder"], parts["lexical"]),
        llm=parts["llm"],
        conversations=ConversationStore(settings),
        suggestions=SuggestionEngine(chunks),
        metrics=registry,
    )

    await service.answer("What areas of law does SLA handle?")
    snapshot = registry.snapshot()
    assert snapshot["totals"]["turns"] == 1
    assert snapshot["latency_ms"]["total"]["p50"] > 0


@pytest.mark.asyncio
async def test_a_metrics_failure_never_breaks_an_answer(settings, parts, chunks):
    """Observability must not become the thing that takes the feature down."""
    from app.services.chat_service import ChatService
    from app.conversation.memory import ConversationStore
    from app.services.suggestions import SuggestionEngine

    class BrokenRegistry:
        def record(self, turn):
            raise RuntimeError("metrics backend exploded")

    parts["store"].hits = [make_hit(score=0.82)]
    service = ChatService(
        settings=settings,
        retrieval=RetrievalService(settings, parts["store"], parts["embedder"], parts["lexical"]),
        llm=parts["llm"],
        conversations=ConversationStore(settings),
        suggestions=SuggestionEngine(chunks),
        metrics=BrokenRegistry(),
    )

    answer = await service.answer("What areas of law does SLA handle?")
    assert answer.answer
