"""Celery application.

Indexing is the one thing in this project that genuinely wants a queue.
Publishing one short document takes a second or two and stays a synchronous
request; reindexing the whole knowledge base is one embedding round trip per
document, grows with the corpus, and would otherwise hold a request thread open
for minutes behind a proxy that will time out first.

**The database stays the durable record, not the queue.** Every unit of work is
an ``IngestionJob`` row before a task is dispatched, so the audit trail survives
a broker restart and a lost message shows up as a job stuck in QUEUED — visible
in the admin and recoverable with ``recover_stale_jobs()``. Celery's own result
backend is a convenience for polling, never the source of truth about what was
published.

**Tasks are idempotent by construction**, which is what makes ``acks_late`` safe
here: chunk ids are a deterministic hash of document and version, so a task that
runs twice overwrites the same points instead of duplicating them. That property
lives in the AI service's chunker, not in this file, but it is the reason these
settings are chosen.
"""

from __future__ import annotations

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sla.settings")

app = Celery("sla")

# Configuration comes from Django settings, CELERY_-prefixed, so there is one
# settings file rather than a second configuration system to keep in step.
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):  # pragma: no cover - operational aid
    """Confirms a worker is connected and consuming from the broker."""
    return f"ok from {self.request.hostname}"
