"""Admin API: authorization, lifecycle, and the guarantees around publishing.

The AI service is stubbed throughout. What is worth testing here is Django's
half — who may call what, what a version is, and whether a failed index can
leave a document claiming to be live. Whether Qdrant actually stores a vector
is the AI service's own concern and is covered by its suite.
"""

from __future__ import annotations

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

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
    create_version,
    publish,
    unpublish,
)

User = get_user_model()

INDEX_OK = {"chunks_indexed": 3, "duration_ms": 120}


def _stub(result=None, side_effect=None):
    return patch("knowledge.services._call_ai_service", return_value=result, side_effect=side_effect)


class AuthorizationTests(TestCase):
    """Route guards in the SPA are usability; these are the security."""

    def setUp(self):
        self.admin = User.objects.create_user("admin", password="pw", is_staff=True)
        self.plain = User.objects.create_user("visitor", password="pw")
        self.document = KnowledgeDocument.objects.create(title="Doc", category="faq")

    def test_anonymous_is_rejected(self):
        for url in ("/api/admin/knowledge/", "/api/admin/dashboard/"):
            self.assertEqual(self.client.get(url).status_code, 401, url)

    def test_authenticated_non_staff_is_rejected(self):
        self.client.login(username="visitor", password="pw")
        response = self.client.get("/api/admin/knowledge/")
        self.assertEqual(response.status_code, 403)

    def test_staff_is_allowed(self):
        self.client.login(username="admin", password="pw")
        self.assertEqual(self.client.get("/api/admin/knowledge/").status_code, 200)

    def test_anonymous_cannot_publish(self):
        """The mutating endpoints matter most — a 401 here is the whole point."""
        response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/publish/")
        self.assertEqual(response.status_code, 401)
        self.document.refresh_from_db()
        self.assertEqual(self.document.status, Status.DRAFT)

    def test_non_staff_cannot_delete(self):
        self.client.login(username="visitor", password="pw")
        response = self.client.delete(f"/api/admin/knowledge/{self.document.pk}/")
        self.assertEqual(response.status_code, 403)
        self.assertTrue(KnowledgeDocument.objects.filter(pk=self.document.pk).exists())


class DocumentApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")

    def _create(self, **overrides):
        payload = {"title": "Fee policy", "content": "Fees are agreed in writing.", "category": "policy"}
        payload.update(overrides)
        return self.client.post(
            "/api/admin/knowledge/", data=json.dumps(payload), content_type="application/json"
        )

    def test_create_starts_as_draft_never_live(self):
        response = self._create()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], Status.DRAFT)
        self.assertFalse(body["is_public"])
        self.assertEqual(body["version"], 1)

    def test_create_rejects_empty_and_oversized_content(self):
        self.assertEqual(self._create(content="   ").status_code, 422)
        self.assertEqual(self._create(content="x" * 100_001).status_code, 422)

    def test_create_rejects_unknown_category(self):
        self.assertEqual(self._create(category="not-a-category").status_code, 422)

    def test_editing_content_creates_a_new_version(self):
        document_id = self._create().json()["id"]
        response = self.client.patch(
            f"/api/admin/knowledge/{document_id}/",
            data=json.dumps({"content": "Fees are agreed in writing, in advance."}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], 2)
        self.assertEqual(KnowledgeVersion.objects.filter(document_id=document_id).count(), 2)

    def test_identical_edit_does_not_create_a_version(self):
        """Embedding costs money per call; saving twice must not bill twice."""
        document_id = self._create().json()["id"]
        self.client.patch(
            f"/api/admin/knowledge/{document_id}/",
            data=json.dumps({"content": "Fees are agreed in writing."}),
            content_type="application/json",
        )
        self.assertEqual(KnowledgeVersion.objects.filter(document_id=document_id).count(), 1)

    def test_publish_marks_live_and_records_the_job(self):
        document_id = self._create().json()["id"]
        with _stub(INDEX_OK):
            response = self.client.post(f"/api/admin/knowledge/{document_id}/publish/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], Status.PUBLISHED)
        self.assertTrue(body["is_public"])
        self.assertEqual(body["chunks_indexed"], 3)

        job = IngestionJob.objects.get(document_id=document_id)
        self.assertEqual(job.status, JobStatus.COMPLETED)
        self.assertEqual(job.chunks_indexed, 3)

    def test_failed_indexing_leaves_the_document_unpublished(self):
        """The failure that matters: never claim live when the vectors are not there."""
        document_id = self._create().json()["id"]
        with _stub(side_effect=IndexingError("qdrant unreachable")):
            response = self.client.post(f"/api/admin/knowledge/{document_id}/publish/")

        self.assertEqual(response.status_code, 502)
        document = KnowledgeDocument.objects.get(pk=document_id)
        self.assertEqual(document.status, Status.DRAFT)
        self.assertFalse(document.is_public)
        self.assertEqual(IngestionJob.objects.get(document_id=document_id).status, JobStatus.FAILED)

    def test_zero_chunks_is_treated_as_failure(self):
        """A successful call that indexed nothing is not a successful publish."""
        document_id = self._create().json()["id"]
        with _stub({"chunks_indexed": 0, "duration_ms": 5}):
            response = self.client.post(f"/api/admin/knowledge/{document_id}/publish/")
        self.assertEqual(response.status_code, 502)
        self.assertEqual(KnowledgeDocument.objects.get(pk=document_id).status, Status.DRAFT)

    def test_unpublish_clears_live_state(self):
        document_id = self._create().json()["id"]
        with _stub(INDEX_OK):
            self.client.post(f"/api/admin/knowledge/{document_id}/publish/")
        with _stub({}):
            response = self.client.post(f"/api/admin/knowledge/{document_id}/unpublish/")
        body = response.json()
        self.assertEqual(body["status"], Status.DRAFT)
        self.assertFalse(body["is_public"])
        self.assertIsNone(body["published_version"])

    def test_editing_published_document_does_not_change_what_is_live(self):
        document_id = self._create().json()["id"]
        with _stub(INDEX_OK):
            self.client.post(f"/api/admin/knowledge/{document_id}/publish/")
        self.client.patch(
            f"/api/admin/knowledge/{document_id}/",
            data=json.dumps({"content": "Completely different, unreviewed text."}),
            content_type="application/json",
        )
        document = KnowledgeDocument.objects.get(pk=document_id)
        self.assertEqual(document.latest_version.version, 2)
        self.assertEqual(document.published_version.version, 1)

    def test_delete_refuses_when_vectors_cannot_be_removed(self):
        """A deleted row whose vectors survive is a chunk no screen can find."""
        document_id = self._create().json()["id"]
        with _stub(side_effect=IndexingError("qdrant unreachable")):
            response = self.client.delete(f"/api/admin/knowledge/{document_id}/")
        self.assertEqual(response.status_code, 502)
        self.assertTrue(KnowledgeDocument.objects.filter(pk=document_id).exists())

    def test_filters_and_search(self):
        self._create(title="Alpha policy", category="policy")
        self._create(title="Beta faq", category="faq")
        results = self.client.get("/api/admin/knowledge/?category=policy").json()["results"]
        self.assertEqual([r["title"] for r in results], ["Alpha policy"])
        results = self.client.get("/api/admin/knowledge/?q=beta").json()["results"]
        self.assertEqual([r["title"] for r in results], ["Beta faq"])

    def test_versions_endpoint_lists_history(self):
        document_id = self._create().json()["id"]
        self.client.patch(
            f"/api/admin/knowledge/{document_id}/",
            data=json.dumps({"content": "Revised."}),
            content_type="application/json",
        )
        body = self.client.get(f"/api/admin/knowledge/{document_id}/versions/").json()
        self.assertEqual([v["version"] for v in body["results"]], [2, 1])

    def test_dashboard_counts(self):
        self._create(title="One")
        document_id = self._create(title="Two").json()["id"]
        with _stub(INDEX_OK):
            self.client.post(f"/api/admin/knowledge/{document_id}/publish/")
        body = self.client.get("/api/admin/dashboard/").json()
        self.assertEqual(body["documents"]["total"], 2)
        self.assertEqual(body["documents"]["published"], 1)
        self.assertEqual(body["documents"]["indexed"], 1)


class ConcurrencyTests(TestCase):
    def test_two_simultaneous_jobs_are_refused(self):
        """Both would delete the old vectors and both write new ones."""
        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        create_version(document, title="Doc", content="Body text.")
        IngestionJob.objects.create(
            document=document, version=document.latest_version, status=JobStatus.PROCESSING
        )
        with self.assertRaises(ConcurrentJobError):
            publish(document)


class ModelTests(TestCase):
    def test_is_public_requires_both_status_and_indexed_version(self):
        """Published-but-never-indexed must not read as live."""
        document = KnowledgeDocument.objects.create(title="Doc", category="faq", status=Status.PUBLISHED)
        self.assertFalse(document.is_public)

    def test_content_hash_covers_the_title(self):
        """The title is prefixed onto every chunk, so changing it changes the vectors."""
        document = KnowledgeDocument.objects.create(title="First", category="faq")
        first = create_version(document, title="First", content="Same body.")
        second = create_version(document, title="Second", content="Same body.")
        self.assertNotEqual(first.content_hash, second.content_hash)
        self.assertEqual(second.version, 2)

    def test_slug_is_generated_from_title(self):
        document = KnowledgeDocument.objects.create(title="Fee Structure & Policy", category="policy")
        self.assertEqual(document.slug, "fee-structure-policy")


class IndexStateTests(TestCase):
    """The denormalised index state must never overstate what Qdrant holds."""

    def setUp(self):
        self.admin = User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")
        self.document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        create_version(self.document, title="Doc", content="Body text.")

    def test_successful_publish_stamps_indexed_state(self):
        with _stub(INDEX_OK):
            publish(self.document)
        self.document.refresh_from_db()
        self.assertEqual(self.document.indexing_status, IndexStatus.INDEXED)
        self.assertIsNotNone(self.document.indexed_at)

    def test_failed_publish_records_failure_and_no_timestamp(self):
        """A failure must not leave a green badge next to unretrievable content."""
        with _stub(side_effect=IndexingError("upstream down")):
            with self.assertRaises(IndexingError):
                publish(self.document)
        self.document.refresh_from_db()
        self.assertEqual(self.document.indexing_status, IndexStatus.FAILED)
        self.assertIsNone(self.document.indexed_at)
        self.assertEqual(self.document.status, Status.DRAFT)

    def test_unpublish_resets_index_state(self):
        """Vectors are gone, so the document is genuinely not indexed any more."""
        with _stub(INDEX_OK):
            publish(self.document)
        with _stub({}):
            unpublish(self.document)
        self.document.refresh_from_db()
        self.assertEqual(self.document.indexing_status, IndexStatus.NEVER)
        self.assertIsNone(self.document.indexed_at)

    def test_editing_a_published_document_marks_it_stale(self):
        """Published, but with edits visitors are not seeing yet."""
        with _stub(INDEX_OK):
            publish(self.document)
        self.document.refresh_from_db()
        self.assertFalse(self.document.is_stale)

        create_version(self.document, title="Doc", content="Revised body text.")
        self.document.refresh_from_db()
        self.assertTrue(self.document.is_stale)

    def test_index_status_filter(self):
        with _stub(INDEX_OK):
            publish(self.document)
        KnowledgeDocument.objects.create(title="Never", category="faq")

        indexed = self.client.get("/api/admin/knowledge/?index_status=indexed").json()
        self.assertEqual([d["title"] for d in indexed["results"]], ["Doc"])

        never = self.client.get("/api/admin/knowledge/?index_status=never").json()
        self.assertEqual([d["title"] for d in never["results"]], ["Never"])

    def test_unknown_index_status_filter_is_ignored_not_fatal(self):
        response = self.client.get("/api/admin/knowledge/?index_status=nonsense")
        self.assertEqual(response.status_code, 200)


class DiagnosticsAuthorizationTests(TestCase):
    """The new admin surfaces are as protected as the old ones."""

    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        User.objects.create_user("visitor", password="pw")

    def test_anonymous_is_rejected_everywhere(self):
        self.assertEqual(self.client.get("/api/admin/system/").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/jobs/").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/evaluation/").status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/admin/retrieval/",
                data=json.dumps({"question": "hi"}),
                content_type="application/json",
            ).status_code,
            401,
        )
        self.assertEqual(self.client.post("/api/admin/knowledge/reindex-all/").status_code, 401)

    def test_non_staff_is_rejected_everywhere(self):
        self.client.login(username="visitor", password="pw")
        self.assertEqual(self.client.get("/api/admin/system/").status_code, 403)
        self.assertEqual(self.client.post("/api/admin/knowledge/reindex-all/").status_code, 403)


class RetrievalTesterTests(TestCase):
    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")

    def _post(self, payload):
        return self.client.post(
            "/api/admin/retrieval/", data=json.dumps(payload), content_type="application/json"
        )

    def test_proxies_the_question_and_history(self):
        with patch("knowledge.views.ai_service_request", return_value={"answerable": True}) as call:
            response = self._post({"question": "What areas of law?", "history": ["earlier turn"]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(call.call_args.args[0], "/internal/retrieval/debug")
        self.assertEqual(call.call_args.kwargs["payload"]["history"], ["earlier turn"])

    def test_empty_question_is_rejected(self):
        self.assertEqual(self._post({"question": "   "}).status_code, 422)

    def test_history_must_be_a_list(self):
        self.assertEqual(self._post({"question": "hi", "history": "nope"}).status_code, 422)

    def test_upstream_failure_becomes_502_not_500(self):
        with patch("knowledge.views.ai_service_request", side_effect=IndexingError("down")):
            self.assertEqual(self._post({"question": "hi"}).status_code, 502)


class EvaluationApiTests(TestCase):
    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")

    def test_defaults_to_retrieval_mode(self):
        """Full mode costs a model call per case, so it is never the default."""
        with patch("knowledge.views.ai_service_request", return_value={"passed": 1}) as call:
            self.client.post(
                "/api/admin/evaluation/", data=json.dumps({}), content_type="application/json"
            )
        self.assertEqual(call.call_args.kwargs["payload"]["mode"], "retrieval")

    def test_full_mode_is_passed_through_when_asked_for(self):
        with patch("knowledge.views.ai_service_request", return_value={}) as call:
            self.client.post(
                "/api/admin/evaluation/",
                data=json.dumps({"mode": "full"}),
                content_type="application/json",
            )
        self.assertEqual(call.call_args.kwargs["payload"]["mode"], "full")

    def test_unknown_mode_falls_back_to_retrieval(self):
        with patch("knowledge.views.ai_service_request", return_value={}) as call:
            self.client.post(
                "/api/admin/evaluation/",
                data=json.dumps({"mode": "expensive"}),
                content_type="application/json",
            )
        self.assertEqual(call.call_args.kwargs["payload"]["mode"], "retrieval")


class SystemStatusTests(TestCase):
    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")

    def test_unreachable_ai_service_does_not_fail_the_status_page(self):
        """A status page that dies with the thing it monitors is not one."""
        with patch("knowledge.views.ai_service_request", side_effect=IndexingError("refused")):
            response = self.client.get("/api/admin/system/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["ai_service"]["status"], "unreachable")
        self.assertEqual(body["redis"]["status"], "not configured")


class BackgroundJobTests(TestCase):
    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")

    def test_bulk_reindex_schedules_only_published_documents(self):
        published = KnowledgeDocument.objects.create(title="Live", category="faq")
        create_version(published, title="Live", content="Body.")
        with _stub(INDEX_OK):
            publish(published)
        KnowledgeDocument.objects.create(title="Draft", category="faq")

        with patch("knowledge.jobs.executor") as pool:
            response = self.client.post("/api/admin/knowledge/reindex-all/")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["scheduled"], 1)
        self.assertEqual(pool.return_value.submit.call_count, 1)

    def test_stale_job_is_recovered_so_a_document_is_never_stuck(self):
        """A killed process must not block a document from ever reindexing."""
        from datetime import timedelta

        from django.utils import timezone

        from .jobs import recover_stale_jobs

        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        version = create_version(document, title="Doc", content="Body.")
        job = IngestionJob.objects.create(
            document=document, version=version, status=JobStatus.PROCESSING
        )
        IngestionJob.objects.filter(pk=job.pk).update(
            created_at=timezone.now() - timedelta(hours=1)
        )

        self.assertEqual(recover_stale_jobs(), 1)
        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.FAILED)
        document.refresh_from_db()
        self.assertEqual(document.indexing_status, IndexStatus.FAILED)

    def test_fresh_active_job_is_not_recovered(self):
        from .jobs import recover_stale_jobs

        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        version = create_version(document, title="Doc", content="Body.")
        IngestionJob.objects.create(document=document, version=version, status=JobStatus.PROCESSING)
        self.assertEqual(recover_stale_jobs(), 0)

    def test_job_list_reports_active_count(self):
        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        version = create_version(document, title="Doc", content="Body.")
        IngestionJob.objects.create(document=document, version=version, status=JobStatus.QUEUED)

        body = self.client.get("/api/admin/jobs/").json()
        self.assertEqual(body["active"], 1)
        self.assertEqual(body["results"][0]["document"], "Doc")


class CeleryDispatchTests(TestCase):
    """Which dispatcher runs the work, and that both do the same work.

    The fallback matters as much as the queue: a developer with no broker must
    still get a working admin panel, and the response must say honestly where
    the work went rather than implying durability it does not have.
    """

    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")
        self.document = KnowledgeDocument.objects.create(title="Live", category="faq")
        create_version(self.document, title="Live", content="Body.")
        with _stub(INDEX_OK):
            publish(self.document)

    def test_celery_is_used_when_a_broker_answers(self):
        with patch("knowledge.jobs.celery_available", return_value=True):
            with patch("knowledge.tasks.reindex_document.delay") as delay:
                response = self.client.post("/api/admin/knowledge/reindex-all/")
        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["dispatcher"], "celery")
        self.assertEqual(body["scheduled"], 1)
        delay.assert_called_once_with(self.document.pk)

    def test_thread_pool_is_used_when_no_broker_answers(self):
        """No Celery must degrade, not fail — and must say so."""
        with patch("knowledge.jobs.celery_available", return_value=False):
            with patch("knowledge.jobs.executor") as pool:
                response = self.client.post("/api/admin/knowledge/reindex-all/")
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["dispatcher"], "in-process")
        self.assertEqual(pool.return_value.submit.call_count, 1)

    def test_dispatcher_is_chosen_once_per_run(self):
        """A broker dying halfway must not split a run across both paths."""
        with patch("knowledge.jobs.celery_available", return_value=True) as check:
            with patch("knowledge.tasks.reindex_document.delay"):
                self.client.post("/api/admin/knowledge/reindex-all/")
        self.assertEqual(check.call_count, 1)

    def test_unconfigured_broker_reports_unavailable(self):
        """A blank CELERY_BROKER_URL must not be probed at all."""
        from knowledge.jobs import celery_available

        with self.settings(CELERY_BROKER_URL=""):
            self.assertFalse(celery_available())

    def test_unreachable_broker_reports_unavailable(self):
        """Configured but not running is the dangerous case: dispatch would
        succeed silently and nothing would ever be indexed."""
        from knowledge.jobs import celery_available

        with self.settings(CELERY_BROKER_URL="redis://127.0.0.1:6399/1"):
            with patch("sla.celery.app.control.ping", side_effect=OSError("refused")):
                self.assertFalse(celery_available())


class CeleryTaskTests(TestCase):
    """The task bodies, run synchronously — no broker involved."""

    def test_task_publishes_a_published_document(self):
        from knowledge.tasks import reindex_document

        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        create_version(document, title="Doc", content="Body.")
        with _stub(INDEX_OK):
            publish(document)
            result = reindex_document(document.pk)
        self.assertEqual(result["chunks_indexed"], INDEX_OK["chunks_indexed"])

    def test_task_skips_an_unpublished_document(self):
        """Indexing a draft would put its vectors live while its status says no."""
        from knowledge.tasks import reindex_document

        document = KnowledgeDocument.objects.create(title="Draft", category="faq")
        create_version(document, title="Draft", content="Body.")
        result = reindex_document(document.pk)
        self.assertEqual(result["skipped"], "not published")

    def test_task_tolerates_a_deleted_document(self):
        """A queued task may outlive the document it was queued for."""
        from knowledge.tasks import reindex_document

        result = reindex_document(999_999)
        self.assertEqual(result["skipped"], "not found")

    def test_task_records_failure_without_raising(self):
        """A raising task loses the operator's report to a worker log."""
        from knowledge.tasks import reindex_document

        document = KnowledgeDocument.objects.create(title="Doc", category="faq")
        create_version(document, title="Doc", content="Body.")
        with _stub(INDEX_OK):
            publish(document)
        with _stub(side_effect=IndexingError("qdrant down")):
            result = reindex_document(document.pk)
        self.assertIn("failed", result)
        document.refresh_from_db()
        self.assertEqual(document.indexing_status, IndexStatus.FAILED)

    def test_recovery_task_delegates_to_the_same_function(self):
        from knowledge.tasks import recover_stale_jobs_task

        self.assertEqual(recover_stale_jobs_task(), 0)


class QueuedPublishTests(TestCase):
    """Publishing through a worker, and the promise the status code makes.

    202 and 200 must mean different things to the panel: one says "poll for the
    outcome", the other says "done". A panel that cannot tell them apart either
    spins forever or reports success before anything reached Qdrant.
    """

    def setUp(self):
        User.objects.create_user("admin", password="pw", is_staff=True)
        self.client.login(username="admin", password="pw")
        self.document = KnowledgeDocument.objects.create(title="Policy", category="policy")
        create_version(self.document, title="Policy", content="Fees are agreed in writing.")

    def test_publish_is_queued_when_a_worker_is_consuming(self):
        with patch("knowledge.jobs.celery_available", return_value=True):
            with patch("knowledge.tasks.publish_document.delay") as delay:
                response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/publish/")

        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertTrue(body["queued"])
        # Marked queued immediately, so the panel's next poll shows the right
        # state rather than the previous one.
        self.assertEqual(body["indexing_status"], IndexStatus.QUEUED)
        delay.assert_called_once()
        self.assertEqual(delay.call_args.args[0], self.document.pk)

    def test_publish_runs_inline_when_no_worker_answers(self):
        """No broker must still publish, not silently do nothing."""
        with patch("knowledge.jobs.celery_available", return_value=False):
            with _stub(INDEX_OK):
                response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/publish/")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertFalse(body["queued"])
        self.assertEqual(body["chunks_indexed"], INDEX_OK["chunks_indexed"])
        self.assertEqual(body["status"], Status.PUBLISHED)

    def test_a_failed_dispatch_does_not_leave_the_document_stuck_queued(self):
        """A document showing 'Queued' with nothing queued never resolves."""
        with patch("knowledge.jobs.celery_available", return_value=True):
            with patch("knowledge.tasks.publish_document.delay", side_effect=OSError("broker gone")):
                with _stub(INDEX_OK):
                    response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/publish/")

        # Fell back to publishing inline rather than reporting a queue that
        # never received the work.
        self.assertEqual(response.status_code, 200)
        self.document.refresh_from_db()
        self.assertNotEqual(self.document.indexing_status, IndexStatus.QUEUED)

    def test_reindex_refuses_an_unpublished_document_before_queueing(self):
        """Refused immediately rather than discovered by a worker."""
        with patch("knowledge.jobs.celery_available", return_value=True):
            with patch("knowledge.tasks.publish_document.delay") as delay:
                response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/reindex/")
        self.assertEqual(response.status_code, 409)
        delay.assert_not_called()

    def test_reindex_is_queued_for_a_published_document(self):
        with _stub(INDEX_OK):
            publish(self.document)
        with patch("knowledge.jobs.celery_available", return_value=True):
            with patch("knowledge.tasks.publish_document.delay") as delay:
                response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/reindex/")
        self.assertEqual(response.status_code, 202)
        delay.assert_called_once()

    def test_unpublish_stays_synchronous(self):
        """Its whole point is that the content stops being retrievable now."""
        with _stub(INDEX_OK):
            publish(self.document)
        with patch("knowledge.jobs.celery_available", return_value=True):
            with _stub({}):
                response = self.client.post(f"/api/admin/knowledge/{self.document.pk}/unpublish/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], Status.DRAFT)

    def test_publish_task_indexes_and_attributes_the_user(self):
        """Run the task body directly — no broker involved."""
        from knowledge.tasks import publish_document

        admin = User.objects.get(username="admin")
        with _stub(INDEX_OK):
            result = publish_document(self.document.pk, admin.pk)

        self.assertEqual(result["chunks_indexed"], INDEX_OK["chunks_indexed"])
        self.document.refresh_from_db()
        self.assertEqual(self.document.status, Status.PUBLISHED)
        self.assertEqual(self.document.jobs.first().requested_by, admin)

    def test_publish_task_records_failure_without_raising(self):
        from knowledge.tasks import publish_document

        with _stub(side_effect=IndexingError("qdrant unreachable")):
            result = publish_document(self.document.pk, None)

        self.assertIn("failed", result)
        self.document.refresh_from_db()
        self.assertEqual(self.document.indexing_status, IndexStatus.FAILED)
        # The failure must not have made it live.
        self.assertEqual(self.document.status, Status.DRAFT)

    def test_publish_task_tolerates_a_deleted_document(self):
        from knowledge.tasks import publish_document

        self.assertEqual(publish_document(999_999, None)["skipped"], "not found")
