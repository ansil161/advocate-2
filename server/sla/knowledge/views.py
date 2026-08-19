"""Admin API for the knowledge base.

Every endpoint here is behind ``@admin_required``. Frontend route guards are a
usability feature — they stop an admin seeing a broken page — and are worth
nothing as security, because the browser is the attacker's machine. The check
that matters is this one, on the server, on every request.

Responses are hand-built dicts rather than a serializer framework: Django REST
Framework is not installed, these are a handful of flat objects, and adding a
dependency to render them would be the kind of infrastructure §48 warns
against. Each ``_as_*`` function is an explicit allow-list, which also means a
field added to a model does not silently start appearing in an API response.
"""

from __future__ import annotations

import functools
import json

from django.db import IntegrityError
from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_protect

from django.conf import settings as django_settings

from .parsers import extract_file_text
from .jobs import celery_available, queue_bulk_reindex, queue_publish
from .models import (
    IndexStatus,
    IngestionJob,
    JobStatus,
    KnowledgeDocument,
    KnowledgeVersion,
    Status,
)
from .services import (
    ConcurrentJobError,
    IndexingError,
    ai_service_request,
    create_version,
    publish,
    reindex,
    unpublish,
)

# Bounded so a malicious or accidental paste cannot fill the database or, worse,
# reach the embedding API as a very expensive single call.
MAX_TITLE_CHARS = 200
MAX_CONTENT_CHARS = 100_000
PAGE_SIZE = 25


def admin_required(view):
    """Authenticated *and* staff. Both, on every request.

    Returns 403 rather than redirecting to a login page: this is an API, and a
    302 to HTML would surface in the SPA as an unparseable success.
    """

    @functools.wraps(view)
    def wrapper(request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return JsonResponse({"error": "authentication required"}, status=401)
        if not user.is_staff:
            return JsonResponse({"error": "administrator access required"}, status=403)
        return view(request, *args, **kwargs)

    return wrapper


def _body(request) -> dict:
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        raise ValueError("request body must be valid JSON")


def _clean_text(data: dict, field: str, *, limit: int, required: bool = True) -> str:
    value = (data.get(field) or "").strip()
    if required and not value:
        raise ValueError(f"{field} is required")
    if len(value) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer")
    return value


def _as_document(document: KnowledgeDocument, *, detail: bool = False) -> dict:
    payload = {
        "id": document.pk,
        "title": document.title,
        "slug": document.slug,
        "category": document.category,
        "status": document.status,
        "source_url": document.source_url,
        "is_public": document.is_public,
        "indexing_status": document.indexing_status,
        "indexed_at": document.indexed_at.isoformat() if document.indexed_at else None,
        # Published, but with newer edits that visitors are not seeing yet.
        "is_stale": document.is_stale,
        "version": document.latest_version.version if document.latest_version else 0,
        "published_version": (
            document.published_version.version if document.published_version_id else None
        ),
        "created_at": document.created_at.isoformat(),
        "updated_at": document.updated_at.isoformat(),
        "published_at": document.published_at.isoformat() if document.published_at else None,
    }
    if detail:
        latest = document.latest_version
        payload["content"] = latest.content if latest else ""
        last_job = document.jobs.first()
        payload["last_job"] = _as_job(last_job) if last_job else None
    return payload


def _as_version(version: KnowledgeVersion) -> dict:
    return {
        "version": version.version,
        "title": version.title,
        # Truncated in list responses: version history is for scanning, and a
        # hundred full documents in one payload is a slow page, not a feature.
        "excerpt": version.content[:280],
        "content_hash": version.content_hash,
        "created_at": version.created_at.isoformat(),
        "created_by": version.created_by.username if version.created_by_id else None,
    }


def _as_job(job: IngestionJob) -> dict:
    return {
        "id": job.pk,
        "status": job.status,
        "version": job.version.version,
        "chunks_indexed": job.chunks_indexed,
        # Operator-facing detail. This API is staff-only, so it is safe here in
        # a way it would never be on the public chat endpoint.
        "error": job.error,
        "created_at": job.created_at.isoformat(),
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(admin_required, name="dispatch")
class DocumentListView(View):
    """GET a filtered page of documents, POST to create a draft."""

    def get(self, request):
        queryset = KnowledgeDocument.objects.select_related("published_version")

        status = request.GET.get("status", "").strip()
        if status in Status.values:
            queryset = queryset.filter(status=status)

        category = request.GET.get("category", "").strip()
        if category:
            queryset = queryset.filter(category=category)

        index_status = request.GET.get("index_status", "").strip()
        if index_status in IndexStatus.values:
            queryset = queryset.filter(indexing_status=index_status)

        # "Updated since" as a plain date. Parsed defensively — a malformed
        # value filters nothing rather than 500ing an admin's list view.
        updated_since = request.GET.get("updated_since", "").strip()
        if updated_since:
            parsed = parse_date(updated_since)
            if parsed:
                queryset = queryset.filter(updated_at__date__gte=parsed)

        search = request.GET.get("q", "").strip()
        if search:
            # icontains rather than full-text: this is an admin list over a
            # small table, and a tsvector index would be machinery for a
            # problem that does not exist yet.
            queryset = queryset.filter(Q(title__icontains=search) | Q(slug__icontains=search))

        try:
            page = max(1, int(request.GET.get("page", "1")))
        except ValueError:
            page = 1

        total = queryset.count()
        start = (page - 1) * PAGE_SIZE
        documents = list(queryset[start : start + PAGE_SIZE])

        return JsonResponse(
            {
                "results": [_as_document(d) for d in documents],
                "total": total,
                "page": page,
                "page_size": PAGE_SIZE,
            }
        )

    def post(self, request):
        try:
            data = _body(request)
            title = _clean_text(data, "title", limit=MAX_TITLE_CHARS)
            content = _clean_text(data, "content", limit=MAX_CONTENT_CHARS)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=422)

        category = (data.get("category") or "faq").strip()
        if category not in dict(KnowledgeDocument._meta.get_field("category").choices):
            return JsonResponse({"error": "unknown category"}, status=422)

        try:
            document = KnowledgeDocument.objects.create(
                title=title,
                category=category,
                source_url=(data.get("source_url") or "").strip()[:500],
                created_by=request.user,
            )
        except IntegrityError:
            return JsonResponse({"error": "a document with that slug already exists"}, status=409)

        create_version(document, title=title, content=content, user=request.user)
        # Created as a draft, never live. Publishing is always a separate,
        # deliberate action — §27's "do not allow accidental publication".
        return JsonResponse(_as_document(document, detail=True), status=201)


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(admin_required, name="dispatch")
class DocumentExtractView(View):
    """Extract text from an uploaded file."""

    def post(self, request):
        if "file" not in request.FILES:
            return JsonResponse({"error": "no file uploaded"}, status=400)
            
        upload_file = request.FILES["file"]
        try:
            extracted_text = extract_file_text(upload_file, upload_file.name)
            return JsonResponse({"text": extracted_text})
        except Exception as exc:
            return JsonResponse({"error": str(exc)}, status=422)


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(admin_required, name="dispatch")
class DocumentDetailView(View):
    def get(self, request, pk: int):
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)
        return JsonResponse(_as_document(document, detail=True))

    def patch(self, request, pk: int):
        """Edit metadata and content. Content changes create a new version.

        Editing never changes what is live. A published document keeps serving
        its published version until someone publishes the new one, so a
        half-finished edit cannot leak to visitors.
        """
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)

        try:
            data = _body(request)
        except ValueError as exc:
            return JsonResponse({"error": str(exc)}, status=422)

        fields: list[str] = []
        if "title" in data:
            try:
                document.title = _clean_text(data, "title", limit=MAX_TITLE_CHARS)
            except ValueError as exc:
                return JsonResponse({"error": str(exc)}, status=422)
            fields.append("title")
        if "category" in data:
            document.category = (data.get("category") or "").strip()
            fields.append("category")
        if "source_url" in data:
            document.source_url = (data.get("source_url") or "").strip()[:500]
            fields.append("source_url")
        if fields:
            document.save(update_fields=[*fields, "updated_at"])

        if "content" in data:
            try:
                content = _clean_text(data, "content", limit=MAX_CONTENT_CHARS)
            except ValueError as exc:
                return JsonResponse({"error": str(exc)}, status=422)
            create_version(document, title=document.title, content=content, user=request.user)

        document.refresh_from_db()
        return JsonResponse(_as_document(document, detail=True))

    def delete(self, request, pk: int):
        """Remove the document and its vectors.

        Vectors first: a deleted row whose embeddings survive is a chunk that
        answers visitors and that no admin screen can find to remove.
        """
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)
        try:
            unpublish(document)
        except IndexingError as exc:
            return JsonResponse(
                {"error": f"could not remove vectors, document kept: {exc}"}, status=502
            )
        document.delete()
        return JsonResponse({"deleted": pk})


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(admin_required, name="dispatch")
class DocumentActionView(View):
    """publish | unpublish | archive | reindex.

    Publishing and reindexing are handed to a Celery worker when one is
    consuming, and run inline when one is not. The two paths return different
    status codes on purpose — 202 means "accepted, poll for the outcome" and 200
    means "done" — because a panel that cannot tell them apart would either show
    a spinner forever or claim success before anything was indexed.

    Unpublishing stays synchronous either way. It is a single delete-by-filter,
    it is fast, and it is the one action whose whole point is that the content
    stops being retrievable *now*.
    """

    def post(self, request, pk: int, action: str):
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)

        try:
            if action == "publish":
                if queue_publish(document, user=request.user):
                    document.refresh_from_db()
                    return JsonResponse(
                        {**_as_document(document, detail=True), "queued": True}, status=202
                    )
                result = publish(document, user=request.user)
                document.refresh_from_db()
                return JsonResponse(
                    {
                        **_as_document(document, detail=True),
                        "chunks_indexed": result.chunks_indexed,
                        "queued": False,
                    }
                )
            if action == "reindex":
                # Reindexing a document that is not live would put its vectors in
                # the collection while its status says it is not. Checked here so
                # the refusal is immediate rather than discovered by a worker.
                if document.status != Status.PUBLISHED:
                    return JsonResponse(
                        {"error": "only a published document can be reindexed"}, status=409
                    )
                if queue_publish(document, user=request.user):
                    document.refresh_from_db()
                    return JsonResponse(
                        {**_as_document(document, detail=True), "queued": True}, status=202
                    )
                result = reindex(document, user=request.user)
                document.refresh_from_db()
                return JsonResponse(
                    {
                        **_as_document(document, detail=True),
                        "chunks_indexed": result.chunks_indexed,
                        "queued": False,
                    }
                )
            if action in {"unpublish", "archive"}:
                unpublish(document, archive=action == "archive")
                document.refresh_from_db()
                return JsonResponse(_as_document(document, detail=True))
        except ConcurrentJobError as exc:
            return JsonResponse({"error": str(exc)}, status=409)
        except IndexingError as exc:
            # 502: the failure is upstream, and the document is unchanged.
            return JsonResponse({"error": str(exc)}, status=502)

        return JsonResponse({"error": "unknown action"}, status=400)


@method_decorator(admin_required, name="dispatch")
class DocumentVersionsView(View):
    def get(self, request, pk: int):
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)
        versions = document.versions.select_related("created_by")[:50]
        return JsonResponse(
            {
                "results": [_as_version(v) for v in versions],
                "published_version": (
                    document.published_version.version if document.published_version_id else None
                ),
            }
        )


@method_decorator(admin_required, name="dispatch")
class DocumentChunksView(View):
    def get(self, request, pk: int):
        document = _find(pk)
        if document is None:
            return JsonResponse({"error": "not found"}, status=404)
        
        try:
            chunks_data = ai_service_request(f"/internal/knowledge/{document.pk}/chunks", method="GET")
            return JsonResponse(chunks_data)
        except IndexingError as exc:
            return JsonResponse({"error": str(exc)}, status=502)


@method_decorator(admin_required, name="dispatch")
class DashboardView(View):
    """Counts and recent activity for the admin landing page."""

    def get(self, request):
        by_status = {
            row["status"]: row["n"]
            for row in KnowledgeDocument.objects.values("status").annotate(n=Count("pk"))
        }
        indexed = KnowledgeDocument.objects.filter(
            status=Status.PUBLISHED, published_version__isnull=False
        ).count()
        failed = IngestionJob.objects.filter(status=JobStatus.FAILED).count()

        recent = IngestionJob.objects.select_related("document", "version")[:10]
        return JsonResponse(
            {
                "documents": {
                    "total": sum(by_status.values()),
                    "draft": by_status.get(Status.DRAFT, 0),
                    "published": by_status.get(Status.PUBLISHED, 0),
                    "archived": by_status.get(Status.ARCHIVED, 0),
                    "indexed": indexed,
                },
                "jobs": {
                    "failed": failed,
                    "active": IngestionJob.objects.filter(
                        status__in=[JobStatus.QUEUED, JobStatus.PROCESSING]
                    ).count(),
                },
                "recent_jobs": [
                    {**_as_job(job), "document": job.document.title} for job in recent
                ],
            }
        )


@method_decorator(admin_required, name="dispatch")
class SystemStatusView(View):
    """Live health of everything the assistant depends on.

    Each upstream is reported independently and a failure to reach one is
    reported as that component being unreachable rather than as the whole
    endpoint failing — a status page that goes down with the thing it monitors
    is not a status page.

    Nothing here can carry a credential: the AI service's own /health and
    /internal/metrics return names and states only, never configuration values.
    """

    def get(self, request):
        components: dict = {}

        try:
            components["ai_service"] = ai_service_request("/api/health", method="GET")
        except IndexingError as exc:
            components["ai_service"] = {"status": "unreachable", "detail": str(exc)[:300]}

        try:
            components["metrics"] = ai_service_request("/internal/metrics", method="GET")
        except IndexingError as exc:
            components["metrics"] = {"error": str(exc)[:300]}

        # Probed, not assumed. Both of these are optional, and the difference
        # between "configured" and "actually answering" is the whole point: a
        # broker URL pointing at a dead Redis would otherwise let every dispatch
        # succeed silently while nothing was ever indexed.
        components["redis"] = _redis_status()
        components["queue"] = _queue_status()
        components["database"] = {"status": "ok", "engine": "postgresql"}
        return JsonResponse(components)


@method_decorator(csrf_protect, name="dispatch")
@method_decorator(admin_required, name="dispatch")
class BulkReindexView(View):
    """Reindex every published document in the background."""

    def post(self, request):
        return JsonResponse(queue_bulk_reindex(), status=202)


@method_decorator(admin_required, name="dispatch")
class JobListView(View):
    """Recent indexing jobs — what the panel polls while a bulk run is going."""

    def get(self, request):
        status = request.GET.get("status", "").strip()
        queryset = IngestionJob.objects.select_related("document", "version")
        if status in JobStatus.values:
            queryset = queryset.filter(status=status)

        jobs = list(queryset[:50])
        return JsonResponse(
            {
                "results": [{**_as_job(job), "document": job.document.title} for job in jobs],
                "active": IngestionJob.objects.filter(
                    status__in=[JobStatus.QUEUED, JobStatus.PROCESSING]
                ).count(),
            }
        )


def _redis_status() -> dict:
    """Whether Redis is configured and reachable, reported separately.

    "Not configured" and "configured but down" need different responses from
    whoever is reading the page, so they are never collapsed into one message.
    """
    url = getattr(django_settings, "REDIS_URL", "")
    if not url:
        return {
            "status": "not configured",
            "detail": (
                "REDIS_URL is unset. The Django cache is local-memory and background "
                "indexing runs on an in-process thread pool, so that work dies with the "
                "process that started it. The AI service reports its own state separately."
            ),
        }
    try:
        import redis

        redis.Redis.from_url(url, socket_connect_timeout=1, socket_timeout=1).ping()
    except Exception as exc:  # noqa: BLE001 - any failure means "not usable"
        return {
            "status": "unreachable",
            "detail": f"REDIS_URL is set but Redis did not answer ({type(exc).__name__}).",
        }
    return {"status": "ok", "detail": "Cache and Celery broker."}


def _queue_status() -> dict:
    """Whether a Celery worker is actually consuming, not merely configured."""
    if not getattr(django_settings, "CELERY_BROKER_URL", ""):
        return {
            "status": "in-process",
            "detail": (
                "No CELERY_BROKER_URL. Bulk reindexing runs on a bounded thread pool with "
                "IngestionJob rows as the durable record."
            ),
        }
    if not celery_available():
        return {
            "status": "no workers",
            "detail": (
                "A broker is configured but no worker answered. Bulk reindexing will fall "
                "back to an in-process thread pool. Start one with: celery -A sla worker"
            ),
        }
    return {"status": "ok", "detail": "Celery worker consuming from Redis."}


def _find(pk: int) -> KnowledgeDocument | None:
    return (
        KnowledgeDocument.objects.select_related("published_version")
        .filter(pk=pk)
        .first()
    )
