"""Run the RAG evaluation set from the command line.

    python scripts/evaluate.py                     # retrieval only, no model calls
    python scripts/evaluate.py --mode full         # generates an answer per case
    python scripts/evaluate.py --category adversarial

Same set and same grader the admin panel uses — this is a CLI over
``app.evaluation``, not a second implementation. Useful in CI, or before a
deploy, where clicking a button is not an option.

Exits non-zero when a case fails or a hallucination is recorded, so it can gate
a pipeline. Note that ``--mode retrieval`` cannot grade refusals at all (they
are enforced at generation) and reports them as not measured; a gate that cares
about the safety properties has to run ``--mode full``.
"""

from __future__ import annotations

import argparse
import asyncio

from _bootstrap import bootstrap  # noqa: E402

import httpx  # noqa: E402
from qdrant_client import AsyncQdrantClient  # noqa: E402

from app.clients.qdrant import QdrantStore  # noqa: E402
from app.conversation.memory import ConversationStore  # noqa: E402
from app.evaluation import run_evaluation  # noqa: E402
from app.llm.factory import build_embedder, build_providers  # noqa: E402
from app.llm.providers.huggingface import HuggingFaceClient  # noqa: E402
from app.llm.service import LLMService  # noqa: E402
from app.rag.ingestion.corpus import build_chunks  # noqa: E402
from app.rag.retrieval.hybrid import RetrievalService  # noqa: E402
from app.rag.retrieval.keyword import LexicalIndex  # noqa: E402
from app.rag.retrieval.reranker import build_reranker  # noqa: E402
from app.services.chat_service import ChatService  # noqa: E402
from app.services.suggestions import SuggestionEngine  # noqa: E402


async def main(mode: str, category: str) -> int:
    settings = bootstrap()
    chunks = build_chunks()
    lexical = LexicalIndex(chunks)

    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.llm_timeout_seconds)) as http_client:
        qdrant_client = AsyncQdrantClient(
            url=settings.qdrant_url or None,
            api_key=settings.qdrant_api_key or None,
            timeout=15,
            check_compatibility=False,
        )
        try:
            hugging_face = HuggingFaceClient(settings, http_client)
            store = QdrantStore(settings, qdrant_client)
            embedder = build_embedder(settings, http_client, hugging_face)
            llm = LLMService(settings, build_providers(settings, http_client, hugging_face))
            retrieval = RetrievalService(
                settings, store, embedder, lexical, build_reranker(settings, llm)
            )
            chat = ChatService(
                settings=settings,
                retrieval=retrieval,
                llm=llm,
                conversations=ConversationStore(settings),
                suggestions=SuggestionEngine(chunks),
            )

            report = await run_evaluation(
                chat_service=chat,
                retrieval_service=retrieval,
                mode=mode,
                category=category,
            )
        finally:
            await qdrant_client.close()

    print(
        f"\n{report.mode} mode — {report.passed} passed, {report.failed} failed, "
        f"{report.skipped} not gradeable, {report.hallucinations} hallucination(s) "
        f"of {report.total} cases in {report.duration_ms / 1000:.1f}s"
    )
    for name, value in report.scores.items():
        shown = "not measured" if value == -1 else f"{value}%"
        print(f"  {name:<22} {shown}")

    failures = [r for r in report.results if not r.passed and not r.skipped]
    if failures:
        print("\nfailures:")
        for row in failures:
            print(f"  [{row.id}] {row.question}\n      {row.failure}")

    return 1 if failures or report.hallucinations else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--mode", choices=["retrieval", "full"], default="retrieval")
    parser.add_argument("--category", default="", help="limit to one category")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(mode=args.mode, category=args.category)))
