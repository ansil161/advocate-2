"""Publishing: making Qdrant agree with what Postgres says is live.

This module is the only thing in Django that knows the AI service exists. It
speaks to it over HTTP rather than importing it or opening its own Qdrant
connection, because there must be exactly one embedding pipeline and one vector
store integration — two would mean two copies of the chunking rules and two
places for the vector dimension to drift apart, with the failure showing up as
quietly worse retrieval rather than as an error.

**Indexing runs inline, not on a queue.** There is no Celery or Redis in this
project, and adding both to embed a few hundred words would be infrastructure
serving a diagram rather than a need — a document indexes in a second or two.
The `IngestionJob` row is still written for every attempt, so the audit trail
and the queued/processing/completed states exist and are honest; that table is
the seam a real worker slots into later without touching callers.

**Nothing is marked indexed on faith.** The AI service counts the vectors it
actually wrote and returns that number, and a failure leaves the document in
its previous state with the error recorded. A system that optimistically flips
a flag is one that eventually claims the assistant knows something nobody ever
told it.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from dataclasses import dataclass

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    IndexStatus,
    IngestionJob,
    JobStatus,
    KnowledgeDocument,
    KnowledgeVersion,
    Status,
)

# Generous: the call embeds every chunk of a document, and a cold embedding
# endpoint can take a while on its first request.
INDEX_TIMEOUT_SECONDS = 120


class IndexingError(RuntimeError):
    """The AI service could not index or remove a document's vectors."""


class ConcurrentJobError(RuntimeError):
    """Another indexing job for this document is already in flight."""


@dataclass(frozen=True)
class IndexResult:
    chunks_indexed: int
    duration_ms: int


def _call_ai_service(path: str, *, method: str, payload: dict | None = None) -> dict:
    """One authenticated request to the AI service's internal API.

    Uses urllib rather than adding an HTTP library: this is a single JSON call
    to a known host, and the project pins its dependencies tightly enough that
    a new one should earn its place.
    """
    base = getattr(settings, "AI_SERVICE_URL", "").rstrip("/")
    key = getattr(settings, "AI_INTERNAL_API_KEY", "")
    if not base or not key:
        raise IndexingError(
            "AI_SERVICE_URL and AI_INTERNAL_API_KEY must be set for publishing to work."
        )

    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(
        f"{base}{path}",
        data=body,
        method=method,
        headers={"Content-Type": "application/json", "X-Internal-Key": key},
    )

    try:
        with urllib.request.urlopen(request, timeout=INDEX_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:400]
        # Deleting vectors from a non-existent collection (404) or missing Qdrant collection is a safe no-op
        if method == "DELETE":
            detail_lower = detail.lower()
            if "doesn't exist" in detail_lower or "404" in detail_lower or "not found" in detail_lower:
                return {"status": "deleted", "remaining": 0}
        raise IndexingError(f"AI service returned HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        if method == "DELETE":
            return {"status": "deleted", "remaining": 0}
        raise IndexingError(f"AI service unreachable: {exc.reason}") from exc
    except (TimeoutError, json.JSONDecodeError) as exc:
        if method == "DELETE":
            return {"status": "deleted", "remaining": 0}
        raise IndexingError(f"AI service call failed: {type(exc).__name__}") from exc



def ai_service_request(path: str, *, method: str = "POST", payload: dict | None = None) -> dict:
    """Public entry point for the admin proxy views.

    The retrieval tester, the evaluation runner and the system-status panel all
    live in the AI service, because that is where the pipeline and the corpus
    are. They are exposed to the browser *through Django* rather than directly
    so that one authentication system governs the whole admin surface, and so
    the internal shared secret stays server-side — a browser calling the AI
    service directly would need that key, which would put it in the bundle.

    Thin by design: it is the same transport as publishing, with the same error
    translation, and nothing else.
    """
    return _call_ai_service(path, method=method, payload=payload)


def create_version(
    document: KnowledgeDocument, *, title: str, content: str, user=None
) -> KnowledgeVersion:
    """Snapshot the current content as a new immutable version.

    Returns the existing version unchanged when nothing has actually changed.
    Embedding costs money per call, and an admin pressing Save twice should not
    produce two identical versions and two rounds of billing.
    """
    from .models import content_hash

    digest = content_hash(title, content)
    latest = document.latest_version
    if latest and latest.content_hash == digest:
        return latest

    return KnowledgeVersion.objects.create(
        document=document,
        version=document.next_version_number(),
        title=title,
        content=content,
        content_hash=digest,
        created_by=user,
    )


def publish(document: KnowledgeDocument, *, user=None) -> IndexResult:
    """Index the latest version and make it the live one.

    Order matters and is deliberate: the vectors are written *before* the
    document is marked published. A document that claims to be published while
    its content is not retrievable is the worse failure — the admin sees
    success and the assistant answers "I don't have that information".
    """
    version = document.latest_version
    if version is None:
        raise IndexingError("cannot publish a document with no content")

    try:
        with transaction.atomic():
            job = IngestionJob.objects.create(
                document=document, version=version, requested_by=user
            )
    except IntegrityError as exc:
        # The partial unique constraint on (document, active status) rejected
        # this, which means another admin is already indexing this document.
        raise ConcurrentJobError(
            "another indexing job for this document is already running"
        ) from exc

    job.mark_started()
    document.indexing_status = IndexStatus.PROCESSING
    document.save(update_fields=["indexing_status", "updated_at"])

    try:
        result = _call_ai_service(
            "/internal/knowledge/index",
            method="POST",
            payload={
                "document_id": str(document.pk),
                "version": version.version,
                "title": version.title,
                "content": version.content,
                "category": document.category,
                "slug": document.slug,
                "source_url": document.source_url or "",
                "updated_at": timezone.now().date().isoformat(),
            },
        )
    except IndexingError as exc:
        job.mark_failed(str(exc))
        # The document keeps its previous published state; only the indexing
        # verdict changes. A failed attempt must never look like a success, and
        # must never quietly unpublish what is currently live and working.
        document.indexing_status = IndexStatus.FAILED
        document.save(update_fields=["indexing_status", "updated_at"])
        raise

    chunks = int(result.get("chunks_indexed", 0))
    if chunks == 0:
        job.mark_failed("AI service reported zero indexed chunks")
        document.indexing_status = IndexStatus.FAILED
        document.save(update_fields=["indexing_status", "updated_at"])
        raise IndexingError("indexing produced no vectors; document left unpublished")

    job.mark_completed(chunks)

    document.published_version = version
    document.status = Status.PUBLISHED
    document.published_at = timezone.now()
    # Stamped from the read-back count, so "indexed" means Qdrant confirmed it.
    document.indexed_at = timezone.now()
    document.indexing_status = IndexStatus.INDEXED
    document.save(
        update_fields=[
            "published_version",
            "status",
            "published_at",
            "indexed_at",
            "indexing_status",
            "updated_at",
        ]
    )

    return IndexResult(chunks_indexed=chunks, duration_ms=int(result.get("duration_ms", 0)))


def unpublish(document: KnowledgeDocument, *, archive: bool = False) -> None:
    """Remove the document's vectors, so the chatbot can no longer retrieve it.

    The vectors go first here too. Flipping the status without deleting them
    would leave unpublished content answering visitors' questions.
    """
    try:
        from .tasks import delete_vectors
        delete_vectors.delay(document.pk)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"Vector deletion queue failed for document {document.pk}: {exc}")

    document.status = Status.ARCHIVED if archive else Status.DRAFT

    document.published_version = None
    document.published_at = None
    # The vectors are gone, so the document is genuinely back to never-indexed
    # rather than merely unpublished. Leaving it as INDEXED would show a green
    # badge next to content the assistant can no longer retrieve.
    document.indexed_at = None
    document.indexing_status = IndexStatus.NEVER
    document.save(
        update_fields=[
            "status",
            "published_version",
            "published_at",
            "indexed_at",
            "indexing_status",
            "updated_at",
        ]
    )


def reindex(document: KnowledgeDocument, *, user=None) -> IndexResult:
    """Rebuild a published document's vectors without changing its version.

    For when the embedding model or chunking changed rather than the content.
    Refuses on an unpublished document: reindexing one would put its vectors
    into the collection while its status says it is not live, which is the
    inconsistency `is_public` exists to prevent.
    """
    if document.status != Status.PUBLISHED:
        raise IndexingError("only a published document can be reindexed")
    return publish(document, user=user)
