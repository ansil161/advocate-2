"""Django project package.

The Celery app is imported here so that ``@shared_task`` is bound to it whenever
Django starts — the web process, a management command and the worker all end up
with the same configured app. Without this import the decorator resolves to a
default app with no broker, and dispatching silently does nothing.

Guarded so the project still starts if Celery is not installed: the queue is
optional, exactly like Redis, and indexing falls back to running in-process.
"""

try:
    from sla.celery import app as celery_app
except ImportError:  # pragma: no cover - celery is an optional dependency
    celery_app = None

__all__ = ("celery_app",)
