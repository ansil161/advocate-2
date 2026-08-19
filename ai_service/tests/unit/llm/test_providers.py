"""Provider abstraction: translation, failover, and the circuit breaker.

None of these call a network. The behaviour worth pinning here is the logic
that decides *what gets sent* and *who gets asked next* — a wrong role mapping
or a breaker that never reopens is invisible in a live smoke test and expensive
in production.
"""

from __future__ import annotations

import pytest

from app.llm.providers.gemini import extract_stream_text, extract_text, to_gemini_payload
from app.llm.providers.openai_compatible import extract_text as openai_extract_text
from app.rag.ingestion.embedder import normalise
from app.llm.circuit_breaker import CircuitBreaker, State
from app.core.exceptions import GenerationError
from app.llm.service import LLMService


# ── Gemini request translation ───────────────────────────────────────────────


def test_system_message_is_hoisted_out_of_the_turn_list(settings):
    payload = to_gemini_payload(
        [
            {"role": "system", "content": "You are the assistant."},
            {"role": "user", "content": "Hello"},
        ],
        settings,
    )
    assert payload["systemInstruction"]["parts"][0]["text"] == "You are the assistant."
    # The system text must not also appear as a turn — Gemini would read it as
    # visitor input, which is exactly the privilege boundary the prompt relies on.
    assert [t["role"] for t in payload["contents"]] == ["user"]


def test_assistant_role_is_renamed_to_model(settings):
    payload = to_gemini_payload(
        [
            {"role": "user", "content": "one"},
            {"role": "assistant", "content": "two"},
            {"role": "user", "content": "three"},
        ],
        settings,
    )
    assert [t["role"] for t in payload["contents"]] == ["user", "model", "user"]


def test_consecutive_same_role_turns_are_merged(settings):
    """Gemini rejects a non-alternating contents array; history replay can produce one."""
    payload = to_gemini_payload(
        [
            {"role": "user", "content": "first"},
            {"role": "user", "content": "second"},
        ],
        settings,
    )
    assert len(payload["contents"]) == 1
    assert payload["contents"][0]["parts"][0]["text"] == "first\n\nsecond"


def test_empty_and_unknown_roles_are_dropped(settings):
    payload = to_gemini_payload(
        [
            {"role": "user", "content": "   "},
            {"role": "tool", "content": "ignored"},
            {"role": "user", "content": "kept"},
        ],
        settings,
    )
    assert len(payload["contents"]) == 1
    assert payload["contents"][0]["parts"][0]["text"] == "kept"


def test_generation_config_follows_settings(settings):
    payload = to_gemini_payload([{"role": "user", "content": "hi"}], settings)
    assert payload["safetySettings"], "safety thresholds must be sent explicitly"


def test_output_ceiling_pays_for_reasoning_on_top_of_the_answer(settings):
    """Gemini charges reasoning to the same ceiling as the reply.

    Sending LLM_MAX_OUTPUT_TOKENS alone spends almost all of it on reasoning —
    measured at 479 of 500 — and truncates every answer mid-sentence.
    """
    payload = to_gemini_payload([{"role": "user", "content": "hi"}], settings)
    assert payload["generationConfig"]["maxOutputTokens"] == (
        settings.llm_max_output_tokens + settings.gemini_thinking_headroom_tokens
    )


def test_thinking_level_is_sent(settings):
    payload = to_gemini_payload([{"role": "user", "content": "hi"}], settings)
    assert payload["generationConfig"]["thinkingConfig"] == {
        "thinkingLevel": settings.gemini_thinking_level
    }


def test_blank_thinking_level_omits_the_field(settings):
    """A model that rejects the field must be usable by clearing the setting."""
    settings.gemini_thinking_level = "   "
    payload = to_gemini_payload([{"role": "user", "content": "hi"}], settings)
    assert "thinkingConfig" not in payload["generationConfig"]


# ── Gemini response handling ─────────────────────────────────────────────────


def _candidate(text: str, finish: str = "STOP") -> dict:
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": finish}]}


def test_extract_text_returns_the_completion():
    assert extract_text(_candidate("An answer.")) == "An answer."


def test_blocked_prompt_raises():
    with pytest.raises(GenerationError, match="prompt blocked"):
        extract_text({"promptFeedback": {"blockReason": "SAFETY"}})


def test_safety_filtered_completion_raises():
    with pytest.raises(GenerationError, match="completion blocked"):
        extract_text(_candidate("", finish="SAFETY"))


def test_truncated_completion_is_kept_not_discarded():
    """MAX_TOKENS is truncation, not refusal — the grounded text still stands."""
    text = extract_text(
        _candidate("The firm handles banking work. It also hand", finish="MAX_TOKENS")
    )
    assert text.startswith("The firm handles banking work.")


def test_truncated_completion_is_cut_back_to_a_finished_sentence():
    """A reply ending mid-clause reads as broken, and on a list of practice
    areas it misstates what the firm does."""
    assert (
        extract_text(_candidate("We practise here. These include Civil Litigation", finish="MAX_TOKENS"))
        == "We practise here."
    )


def test_truncation_keeps_a_fragment_that_has_no_sentence_end():
    """With nothing complete to fall back to, the fragment is the whole answer."""
    assert extract_text(_candidate("A partial ans", finish="MAX_TOKENS")) == "A partial ans"


def test_a_complete_answer_is_never_trimmed():
    """Only MAX_TOKENS triggers this; a normal reply is passed through whole."""
    assert (
        extract_text(_candidate("First point. And a trailing clause without a stop"))
        == "First point. And a trailing clause without a stop"
    )


def test_empty_whole_response_raises():
    with pytest.raises(GenerationError, match="empty completion"):
        extract_text(_candidate("   "))


def test_empty_stream_frame_is_tolerated():
    """The final SSE frame carries only finishReason; it must not raise."""
    assert extract_stream_text({"candidates": [{"finishReason": "STOP"}]}) == ""


def test_stream_frame_still_enforces_refusals():
    with pytest.raises(GenerationError, match="completion blocked"):
        extract_stream_text(_candidate("", finish="SAFETY"))


# ── OpenAI-compatible (Groq) response handling ───────────────────────────────


def test_openai_shape_is_extracted():
    data = {"choices": [{"message": {"content": "Groq answer."}}]}
    assert openai_extract_text(data) == "Groq answer."


def test_openai_malformed_shape_raises():
    with pytest.raises(GenerationError, match="unexpected chat completion shape"):
        openai_extract_text({"choices": []})


# ── Embedding normalisation ──────────────────────────────────────────────────


def test_normalise_produces_unit_length():
    out = normalise([3.0, 4.0])
    assert out == pytest.approx([0.6, 0.8])


def test_normalise_leaves_zero_vector_alone():
    """No direction to preserve, and dividing by its norm would raise."""
    assert normalise([0.0, 0.0]) == [0.0, 0.0]


# ── Circuit breaker ──────────────────────────────────────────────────────────


def test_breaker_opens_after_threshold_failures():
    breaker = CircuitBreaker("test", failure_threshold=3, cooldown_seconds=60)
    assert breaker.allows()
    for _ in range(3):
        breaker.record_failure()
    assert breaker.state is State.OPEN
    assert not breaker.allows()


def test_success_resets_the_failure_count():
    breaker = CircuitBreaker("test", failure_threshold=3, cooldown_seconds=60)
    breaker.record_failure()
    breaker.record_failure()
    breaker.record_success()
    breaker.record_failure()
    assert breaker.state is State.CLOSED, "count must restart, not accumulate across successes"


def test_breaker_half_opens_after_cooldown_and_admits_one_probe():
    breaker = CircuitBreaker("test", failure_threshold=1, cooldown_seconds=0)
    breaker.record_failure()
    assert breaker.state is State.OPEN

    assert breaker.allows(), "cooldown of 0 should admit a probe immediately"
    assert breaker.state is State.HALF_OPEN
    # Exactly one probe: a second concurrent caller must not also be admitted,
    # or a still-broken provider gets a stampede instead of a single test.
    assert not breaker.allows()


def test_failed_probe_reopens_without_re_accumulating():
    breaker = CircuitBreaker("test", failure_threshold=5, cooldown_seconds=0)
    for _ in range(5):
        breaker.record_failure()
    assert breaker.allows()          # -> HALF_OPEN
    breaker.record_failure()          # probe fails
    assert breaker.state is State.OPEN


def test_successful_probe_closes_the_breaker():
    breaker = CircuitBreaker("test", failure_threshold=1, cooldown_seconds=0)
    breaker.record_failure()
    assert breaker.allows()
    breaker.record_success()
    assert breaker.state is State.CLOSED


# ── Failover across providers ────────────────────────────────────────────────


class StubProvider:
    def __init__(self, name: str, *, reply: str | None = None, configured: bool = True) -> None:
        self._name = name
        self._reply = reply
        self._configured = configured
        self.calls = 0

    @property
    def name(self) -> str:
        return self._name

    @property
    def configured(self) -> bool:
        return self._configured

    async def generate(self, messages):  # noqa: ANN001
        self.calls += 1
        if self._reply is None:
            raise GenerationError(f"{self._name} is down")
        return self._reply

    async def stream(self, messages):  # noqa: ANN001
        yield await self.generate(messages)


MSGS = [{"role": "user", "content": "hi"}]


@pytest.mark.asyncio
async def test_first_healthy_provider_answers(settings):
    primary = StubProvider("primary", reply="from primary")
    secondary = StubProvider("secondary", reply="from secondary")
    answer, who = await LLMService(settings, [primary, secondary]).generate(MSGS)
    assert (answer, who) == ("From primary", "primary")
    assert secondary.calls == 0, "a healthy primary must not cost a second call"


@pytest.mark.asyncio
async def test_failover_reaches_the_next_provider(settings):
    dead = StubProvider("dead", reply=None)
    alive = StubProvider("alive", reply="from alive")
    answer, who = await LLMService(settings, [dead, alive]).generate(MSGS)
    assert who == "alive"
    assert answer == "From alive"


@pytest.mark.asyncio
async def test_unconfigured_providers_are_skipped(settings):
    missing = StubProvider("missing", reply="never", configured=False)
    alive = StubProvider("alive", reply="from alive")
    _, who = await LLMService(settings, [missing, alive]).generate(MSGS)
    assert who == "alive"
    assert missing.calls == 0


@pytest.mark.asyncio
async def test_all_providers_down_raises(settings):
    service = LLMService(settings, [StubProvider("a", reply=None), StubProvider("b", reply=None)])
    with pytest.raises(GenerationError):
        await service.generate(MSGS)


@pytest.mark.asyncio
async def test_open_breaker_stops_calling_a_dead_provider(settings):
    """The point of the breaker: a known-dead provider costs zero calls, not a retry budget."""
    dead = StubProvider("dead", reply=None)
    alive = StubProvider("alive", reply="ok")
    tuned = settings.model_copy(update={"circuit_failure_threshold": 2, "circuit_cooldown_seconds": 60})
    service = LLMService(tuned, [dead, alive])

    for _ in range(2):
        await service.generate(MSGS)
    calls_after_tripping = dead.calls

    await service.generate(MSGS)
    assert dead.calls == calls_after_tripping, "open breaker must skip the provider entirely"


@pytest.mark.asyncio
async def test_leaked_completion_falls_through_to_the_next_provider(settings):
    """A provider reciting the prompt is discarded, not repaired — and is not a breaker failure."""
    leaky = StubProvider("leaky", reply="<<<REFERENCE MATERIAL>>> my system message")
    clean = StubProvider("clean", reply="A proper answer.")
    answer, who = await LLMService(settings, [leaky, clean]).generate(MSGS)
    assert who == "clean"
    assert "<<<" not in answer


@pytest.mark.asyncio
async def test_stream_falls_over_before_first_token(settings):
    dead = StubProvider("dead", reply=None)
    alive = StubProvider("alive", reply="streamed")
    service = LLMService(settings, [dead, alive])
    out = [fragment async for fragment, _ in service.stream(MSGS)]
    assert "".join(out) == "streamed"


@pytest.mark.asyncio
async def test_health_reports_every_provider(settings):
    service = LLMService(settings, [StubProvider("a", reply="x"), StubProvider("b", reply=None, configured=False)])
    health = service.health()
    assert {h["provider"] for h in health} == {"a", "b"}
    assert any(h["configured"] is False for h in health)
