"""The orchestrator: one question in, one grounded answer out.

This is where the fallback chain lives, and the chain is the point. Each layer
below degrades what the assistant can *say* without ever degrading what it is
allowed to say it *from*:

1. **Vector retrieval + generation.** The normal path.
2. **Lexical retrieval + generation.** The embedding endpoint is down; words
   are matched instead of meaning, against the same approved corpus.
3. **Quote the source.** Retrieval worked but every model failed. The top
   passage is shown as the firm's own words, framed as a quote, rather than
   composed into a reply.
4. **Say there is nothing.** Retrieval found nothing above threshold. The
   assistant declines and points to the firm.
5. **Say it is unavailable.** Nothing worked at all.

Note what is absent: there is no layer where the model answers without
retrieved context. That would be the obvious fifth option and it is exactly the
one a law firm cannot have — it is the configuration in which a chatbot
confidently invents an enrolment number.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field

from app.core.types import SearchHit
from app.core import messages as canned
from app.core.config import Settings
from app.core.exceptions import GenerationError
from app.core.logging import get_logger, request_id_var
from app.core.metrics import MetricsRegistry, TurnRecord
from app.conversation.memory import ConversationStore
from app.llm.service import LLMService
from app.prompts.rag import build_messages
from app.rag.retrieval.hybrid import RetrievalService
from app.services.suggestions import SuggestionEngine

log = get_logger(__name__)

# How many sources are attributed under an answer. Three is enough to show the
# answer is grounded and few enough to stay readable in a 400px panel.
MAX_SOURCES = 3

# A quoted passage is shown to the visitor verbatim, so it is capped at
# something that reads as a quotation rather than as a wall of text.
MAX_QUOTE_CHARS = 600


@dataclass(frozen=True)
class Source:
    title: str
    section: str
    url: str


@dataclass(frozen=True)
class ChatAnswer:
    answer: str
    conversation_id: str
    sources: list[Source] = field(default_factory=list)
    suggested_questions: list[str] = field(default_factory=list)
    # "generated" | "quoted" | "no_context" | "unavailable" — lets the client
    # style a degraded reply differently, and lets logs show which layer
    # answered without recording what was said.
    mode: str = "generated"
    degraded: bool = False


class ChatService:
    def __init__(
        self,
        settings: Settings,
        retrieval: RetrievalService,
        llm: LLMService,
        conversations: ConversationStore,
        suggestions: SuggestionEngine,
        metrics: MetricsRegistry | None = None,
    ) -> None:
        self._settings = settings
        self._retrieval = retrieval
        self._llm = llm
        self._conversations = conversations
        self._suggestions = suggestions
        # Optional so the many tests that construct this directly keep working;
        # main.py always supplies one.
        self._metrics = metrics

    @property
    def retrieval(self):
        """The retrieval pipeline this service answers from.

        Exposed because the admin retrieval tester must trace the *same*
        pipeline a visitor's question uses. Read-only and deliberately not a
        setter: swapping it after construction would mean the tester and the
        chat endpoint could diverge, which is the one thing that tool must
        never do.
        """
        return self._retrieval

    def _record(self, **fields) -> None:
        """Send one turn to the metrics window, if a registry is attached.

        Wrapped so that a metrics failure can never take down an answer that was
        otherwise produced correctly — observability is worth a great deal right
        up until it becomes the thing that breaks the feature.
        """
        if self._metrics is None:
            return
        try:
            self._metrics.record(TurnRecord(request_id=request_id_var.get(), **fields))
        except Exception:  # noqa: BLE001 - never let bookkeeping break a reply
            log.warning("failed to record turn metrics", extra={"event": "metrics_failed"})

    async def answer(self, message: str, conversation_id: str | None = None) -> ChatAnswer:
        started = time.perf_counter()
        # Generated rather than accepted from the client when absent. A client
        # is free to send one back to continue a thread, but it cannot make the
        # server adopt an id it never issued for a thread that does not exist.
        conversation_id = conversation_id or uuid.uuid4().hex

        history = await self._conversations.history(conversation_id)
        retrieval = await self._retrieval.retrieve(message, history)

        if not retrieval.found:
            log.info(
                "answered without context",
                extra={
                    "event": "chat",
                    "status": "no_context",
                    "source": retrieval.strategy,
                    "chunks": 0,
                    "message_chars": len(message),
                    "conversation": conversation_id[:8],
                    "duration_ms": round((time.perf_counter() - started) * 1000),
                },
            )
            answer = ChatAnswer(
                answer=canned.NO_CONTEXT,
                conversation_id=conversation_id,
                suggested_questions=self._suggestions.follow_up([], message),
                mode="no_context",
                degraded=retrieval.degraded,
            )
            self._record(
                conversation=conversation_id[:8],
                mode="no_context",
                strategy=retrieval.strategy,
                confidence=retrieval.confidence.level.value if retrieval.confidence else "low",
                provider="",
                model="",
                chunks_retrieved=len(retrieval.fused),
                chunks_used=0,
                degraded=retrieval.degraded,
                total_ms=round((time.perf_counter() - started) * 1000, 2),
                retrieval_ms=_timing(retrieval, "total"),
                rerank_ms=_timing(retrieval, "rerank"),
                llm_ms=0.0,
            )
            # Recorded like any other turn: a visitor's next message is often a
            # rephrasing, and the history is what lets it be understood as one.
            await self._conversations.record(conversation_id, message, answer.answer)
            return answer

        sources = _collect_sources(retrieval.hits)

        generation_error = ""
        llm_started = time.perf_counter()
        try:
            text, model = await self._llm.generate(
                build_messages(
                    question=message,
                    hits=retrieval.hits,
                    history=history,
                    settings=self._settings,
                )
            )
            mode = "generated"
            degraded = retrieval.degraded
        except GenerationError as exc:
            generation_error = exc.code
            log.warning(
                "generation unavailable, quoting source instead",
                extra={"event": "chat_fallback", "reason": exc.detail, "status": "quoted"},
            )
            text = _quote(retrieval.hits[0].text)
            model = "none"
            mode = "quoted"
            degraded = True
        llm_ms = round((time.perf_counter() - llm_started) * 1000, 2)

        self._record(
            conversation=conversation_id[:8],
            mode=mode,
            strategy=retrieval.strategy,
            confidence=retrieval.confidence.level.value if retrieval.confidence else "",
            # The model string is "vendor:model"; the vendor alone is what the
            # dashboard groups by.
            provider=model.split(":", 1)[0] if ":" in model else model,
            model=model,
            chunks_retrieved=len(retrieval.fused),
            chunks_used=len(retrieval.hits),
            degraded=degraded,
            total_ms=round((time.perf_counter() - started) * 1000, 2),
            retrieval_ms=_timing(retrieval, "total"),
            rerank_ms=_timing(retrieval, "rerank"),
            llm_ms=llm_ms,
            error=generation_error,
        )

        log.info(
            "chat complete",
            extra={
                "event": "chat",
                "status": mode,
                "source": retrieval.strategy,
                "chunks": len(retrieval.hits),
                "top_score": round(retrieval.top_score, 4),
                "model": model,
                "message_chars": len(message),
                "conversation": conversation_id[:8],
                "duration_ms": round((time.perf_counter() - started) * 1000),
            },
        )

        answer = ChatAnswer(
            answer=text,
            conversation_id=conversation_id,
            sources=sources,
            suggested_questions=self._suggestions.follow_up(retrieval.hits, message),
            mode=mode,
            degraded=degraded,
        )
        await self._conversations.record(conversation_id, message, answer.answer)
        return answer

    def opening_suggestions(self) -> list[str]:
        return self._suggestions.opening()


def _timing(retrieval, stage: str) -> float:  # noqa: ANN001 - RetrievalResult
    """One stage's milliseconds, or zero if the pipeline did not reach it."""
    if retrieval.trace is None:
        return 0.0
    return retrieval.trace.timings_ms.get(stage, 0.0)


def _collect_sources(hits: list[SearchHit]) -> list[Source]:
    """Attribute the answer, deduplicated by where it points.

    Several chunks of one long document all cite the same page, and listing
    "Team — Sridhar Lendalay" three times reads as padding rather than as
    evidence.
    """
    seen: set[tuple[str, str]] = set()
    sources: list[Source] = []
    for hit in hits:
        key = (hit.document, hit.section)
        if key in seen:
            continue
        seen.add(key)
        sources.append(Source(title=hit.document, section=hit.section, url=hit.url))
        if len(sources) == MAX_SOURCES:
            break
    return sources


def _quote(text: str) -> str:
    """Frame a retrieved passage as a quotation, not as a composed answer.

    The chunk's own repeated heading is dropped — useful to a retriever,
    clutter to a reader — and the passage is cut at a sentence end so it does
    not trail off mid-word.
    """
    body = text.split("\n", 1)[-1].strip() if "\n" in text else text.strip()
    # The keyword line exists only for lexical matching and is noise here.
    body = body.split("\nRelated:", 1)[0].strip()

    if len(body) > MAX_QUOTE_CHARS:
        cut = body[:MAX_QUOTE_CHARS]
        stop = max(cut.rfind(". "), cut.rfind(".\n"))
        body = (cut[: stop + 1] if stop > MAX_QUOTE_CHARS // 2 else cut.rstrip() + "…").strip()

    return f"{canned.QUOTE_PREFIX}\n\n{body}"
