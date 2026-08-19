"""Dispatching background indexing work.

**Celery when a broker is reachable, a thread pool when it is not.** Both paths
run the same ``services.publish``, so what differs is only *where* the work
happens — never what it does. The fallback exists for the same reason Redis is
optional in the AI service: a developer running ``manage.py runserver`` with no
broker should get a working admin panel, and the suite should not need
infrastructure to test the thing it is testing.

**Why anything is backgrounded at all.** Publishing one document takes a second
or two and stays a normal synchronous request; making it asynchronous would cost
the caller a polling loop to save nothing. Reindexing *every* document is
different: it is one embedding round trip per document, it grows with the
corpus, and it is the operation that would otherwise hold a request thread open
for minutes and time out behind a proxy.

**The durable record is the database, not the queue.** Every unit of work is an
``IngestionJob`` row before a task is dispatched, so a lost message or a killed
worker leaves evidence rather than silence — a job stuck in QUEUED or PROCESSING
is visible in the admin and recoverable with ``recover_stale_jobs()``. Celery's
result backend is for polling; it is never the source of truth about what was
published.

The thread pool is deliberately tiny, and the Celery worker should be too:
reindexing is upstream-bound — every task waits on the embedding API — so more
concurrency means more load on a rate-limited provider, not more throughput.
"""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.db import close_old_connections, connection
from django.utils import timezone

from .models import IndexStatus, IngestionJob, JobStatus, KnowledgeDocument, Status

# Two workers: enough that one slow document does not stall the run, few enough
# that a bulk reindex cannot become a burst against the embedding provider.
MAX_WORKERS = 2

# A job still PROCESSING after this long did not survive a restart — no single
# document takes ten minutes to index, and the AI service's own call timeout is
# two.
STALE_AFTER = timedelta(minutes=10)

_executor: ThreadPoolExecutor | None = None
_lock = threading.Lock()


def recycle_connections() -> None:
    """Drop database connections the server may have closed underneath us.

    A long-lived Celery worker or pool thread holds its connections between
    units of work, so one the database has since dropped — or one past
    ``CONN_MAX_AGE`` — has to be discarded rather than used.

    **Skipped inside an atomic block**, which is the case that matters. Running
    inside a transaction means the task is executing synchronously — a test, or
    ``CELERY_TASK_ALWAYS_EAGER`` — where the caller owns the connection and
    closing it aborts their transaction. Without this guard the symptom is a
    baffling ``InterfaceError: connection already closed`` that only appears once
    a suite has run for longer than ``CONN_MAX_AGE``.
    """
    if connection.in_atomic_block:
        return
    close_old_connections()


def executor() -> ThreadPoolExecutor:
    """The shared pool, created on first use.

    Lazily rather than at import so that management commands, migrations and the
    test runner do not each spin up threads they will never use.
    """
    global _executor
    with _lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=MAX_WORKERS, thread_name_prefix="knowledge-index"
            )
        return _executor


def recover_stale_jobs() -> int:
    """Fail jobs abandoned by a restart, so a document is never stuck.

    The partial unique constraint permits only one active job per document, so
    a job left PROCESSING by a killed process would block that document from
    ever being reindexed again — a permanent failure caused by an unrelated
    deploy. Called on each bulk run and available as a management command.
    """
    cutoff = timezone.now() - STALE_AFTER
    stale = IngestionJob.objects.filter(
        status__in=[JobStatus.QUEUED, JobStatus.PROCESSING], created_at__lt=cutoff
    )
    recovered = 0
    for job in stale:
        job.mark_failed("abandoned — the process running this job did not finish")
        KnowledgeDocument.objects.filter(pk=job.document_id).update(
            indexing_status=IndexStatus.FAILED
        )
        recovered += 1
    return recovered


def _reindex_one(document_id: int) -> None:
    """Reindex a single document on a worker thread.

    Every exception is swallowed *after* being recorded on the job, because an
    exception escaping here would be raised inside a pool thread where nothing
    can see it. The job row is the report.
    """
    # Django's per-thread connections are not cleaned up by the pool, so a
    # long-lived worker would otherwise hold a stale connection open and fail
    # after the database drops it.
    recycle_connections()
    try:
        from .services import IndexingError, publish

        document = KnowledgeDocument.objects.filter(pk=document_id).first()
        if document is None or document.status != Status.PUBLISHED:
            return
        try:
            publish(document)
        except IndexingError:
            # Already recorded on the job and the document by publish().
            pass
    except Exception:  # noqa: BLE001 - a worker thread must never raise
        IngestionJob.objects.filter(
            document_id=document_id, status__in=[JobStatus.QUEUED, JobStatus.PROCESSING]
        ).update(status=JobStatus.FAILED, error="unexpected worker error", finished_at=timezone.now())
    finally:
        recycle_connections()


def celery_available() -> bool:
    """Whether a broker is actually reachable, not merely configured.

    Checked rather than assumed: ``CELERY_BROKER_URL`` pointing at a Redis that
    is not running would otherwise mean every dispatch succeeds silently and no
    document is ever reindexed. The ping is cheap and happens once per bulk run,
    not once per document.
    """
    from django.conf import settings as django_settings

    if not getattr(django_settings, "CELERY_BROKER_URL", ""):
        return False
    try:
        from sla.celery import app

        # A short timeout: this runs inside an admin request, and "no worker
        # answered in a second" is the answer we need.
        return bool(app.control.ping(timeout=1.0))
    except Exception:  # noqa: BLE001 - any broker problem means "use threads"
        return False


def queue_publish(document: KnowledgeDocument, *, user=None) -> bool:
    """Dispatch a publish to a Celery worker. Returns whether it was queued.

    ``False`` means the caller should publish inline — there is no broker, or no
    worker answered — which is what keeps ``runserver`` and the test suite
    working with no infrastructure.

    The document is marked QUEUED *before* the task is dispatched, so the panel
    shows the right state on its very next poll rather than briefly showing the
    previous one and looking as though nothing happened. If the dispatch then
    fails, the status is put back: a document stuck on "Queued" with nothing
    queued is worse than one that never left its previous state.
    """
    if not celery_available():
        return False

    previous = document.indexing_status
    document.indexing_status = IndexStatus.QUEUED
    document.save(update_fields=["indexing_status", "updated_at"])

    try:
        from .tasks import publish_document

        publish_document.delay(document.pk, user.pk if user is not None else None)
    except Exception:  # noqa: BLE001 - a broker that died between the ping and now
        document.indexing_status = previous
        document.save(update_fields=["indexing_status", "updated_at"])
        return False
    return True


def queue_bulk_reindex() -> dict:
    """Reindex every published document, in the background.

    Returns immediately with what was scheduled. Documents that already have an
    active job are skipped rather than queued twice — the constraint would
    reject the second one anyway, and reporting it as scheduled would be a lie
    the admin acts on.
    """
    recovered = recover_stale_jobs()

    busy = set(
        IngestionJob.objects.filter(
            status__in=[JobStatus.QUEUED, JobStatus.PROCESSING]
        ).values_list("document_id", flat=True)
    )
    targets = list(
        KnowledgeDocument.objects.filter(status=Status.PUBLISHED)
        .exclude(pk__in=busy)
        .values_list("pk", flat=True)
    )

    # The dispatcher is chosen once for the whole run, so a broker that dies
    # halfway cannot leave some documents queued and others threaded.
    via_celery = celery_available()
    if via_celery:
        from .tasks import reindex_document

        for document_id in targets:
            reindex_document.delay(document_id)
    else:
        pool = executor()
        for document_id in targets:
            pool.submit(_reindex_one, document_id)

    return {
        "scheduled": len(targets),
        "skipped_busy": len(busy),
        "recovered_stale": recovered,
        # Surfaced so the admin panel can say where the work went. "in-process"
        # means it dies with this process; "celery" means it survives a restart.
        "dispatcher": "celery" if via_celery else "in-process",
    }
