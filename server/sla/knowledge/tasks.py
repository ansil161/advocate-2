"""Celery tasks for indexing.

Thin wrappers on purpose. Each one loads a document and calls the same
``services.publish`` the synchronous path calls, so a document published from a
worker and a document published from a request go through one implementation —
including the ordering guarantees that make the delete-then-write safe.

**Why every exception is caught.** A task that raises leaves Celery to retry or
discard it according to broker configuration, and either way the operator's
record of what happened is a stack trace in a worker log. ``services.publish``
already records the outcome on the ``IngestionJob`` row before re-raising, so
these swallow the exception after that has happened: the report an admin reads is
the job table, and it is complete either way.

``acks_late`` is safe because indexing is idempotent — chunk ids are a
deterministic hash of document and version, so a task re-delivered after a worker
crash overwrites the same points rather than duplicating them.
"""

from __future__ import annotations

from celery import shared_task

from .jobs import recycle_connections
from .models import IndexStatus, KnowledgeDocument, Status


@shared_task(name="knowledge.publish_document", acks_late=True, ignore_result=True)
def publish_document(document_id: int, user_id: int | None = None) -> dict:
    """Index a document's latest version and make it live.

    The task that the admin panel's Publish button dispatches. Embedding a long
    document is several round trips to a rate-limited provider, which is a poor
    thing to hold an HTTP request open for — and a proxy will time out first.

    The user is passed by id rather than as an object because task arguments are
    JSON: a serialised user would be a stale copy, and pickling one to keep it
    live is how a broker becomes a code-execution path.
    """
    recycle_connections()
    try:
        from django.contrib.auth import get_user_model

        from .services import IndexingError, publish

        document = KnowledgeDocument.objects.filter(pk=document_id).first()
        if document is None:
            return {"document_id": document_id, "skipped": "not found"}

        user = None
        if user_id is not None:
            user = get_user_model().objects.filter(pk=user_id).first()

        try:
            result = publish(document, user=user)
        except IndexingError as exc:
            # publish() has already recorded this on the job row and set the
            # document's indexing_status to FAILED. The panel reads that.
            return {"document_id": document_id, "failed": str(exc)[:200]}
        return {"document_id": document_id, "chunks_indexed": result.chunks_indexed}
    except Exception as exc:  # noqa: BLE001 - the job row is the report
        KnowledgeDocument.objects.filter(pk=document_id).update(
            indexing_status=IndexStatus.FAILED
        )
        return {"document_id": document_id, "failed": f"unexpected: {type(exc).__name__}"}
    finally:
        recycle_connections()


@shared_task(name="knowledge.reindex_document", acks_late=True, ignore_result=True)
def reindex_document(document_id: int) -> dict:
    """Re-publish one document's vectors. Used by the bulk reindex fan-out."""
    # A long-lived worker holds its database connections across tasks, so a
    # connection the server has since dropped must be recycled rather than used.
    recycle_connections()
    try:
        from .services import IndexingError, publish

        document = KnowledgeDocument.objects.filter(pk=document_id).first()
        if document is None:
            return {"document_id": document_id, "skipped": "not found"}
        if document.status != Status.PUBLISHED:
            # Reindexing an unpublished document would put its vectors in the
            # collection while its status says it is not live.
            return {"document_id": document_id, "skipped": "not published"}

        try:
            result = publish(document)
        except IndexingError as exc:
            # Already recorded on the job and the document by publish().
            return {"document_id": document_id, "failed": str(exc)[:200]}
        return {"document_id": document_id, "chunks_indexed": result.chunks_indexed}
    except Exception as exc:  # noqa: BLE001 - the job row is the report
        KnowledgeDocument.objects.filter(pk=document_id).update(
            indexing_status=IndexStatus.FAILED
        )
        return {"document_id": document_id, "failed": f"unexpected: {type(exc).__name__}"}
    finally:
        recycle_connections()


@shared_task(name="knowledge.recover_stale_jobs", ignore_result=True)
def recover_stale_jobs_task() -> int:
    """Fail jobs abandoned by a restart, so no document is permanently stuck.

    The partial unique constraint permits only one active job per document, so a
    job left PROCESSING by a killed worker would block that document from ever
    being reindexed again. Worth running on a beat schedule as well as before
    each bulk run.
    """
    recycle_connections()
    from .jobs import recover_stale_jobs

    return recover_stale_jobs()


@shared_task(name="knowledge.delete_vectors", acks_late=True, bind=True, max_retries=10, default_retry_delay=60, ignore_result=True)
def delete_vectors(self, document_id: int) -> dict:
    """Asynchronously delete vectors from Qdrant with retries."""
    recycle_connections()
    try:
        from .services import ai_service_request, IndexingError
        try:
            ai_service_request(f"/internal/knowledge/{document_id}", method="DELETE")
        except IndexingError as exc:
            # Retry if the AI service is unreachable or errors
            raise self.retry(exc=exc)
        return {"document_id": document_id, "status": "deleted"}
    finally:
        recycle_connections()
