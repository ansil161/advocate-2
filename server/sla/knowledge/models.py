"""The authoritative store for admin-managed knowledge.

**What lives here, and what deliberately does not.** The website's own content —
practice areas, advocate profiles, the firm's story — is authored in
``client/src/data/*.js`` and exported to the AI service by ``npm run knowledge``.
That content is *not* copied into these tables. Doing so would create two
editable copies of the same fact with no way to say which is right, which is
exactly the duplication §44 warns about: the team page and a `team` row would
drift, and nothing would detect it.

These tables hold knowledge that has no home on the site — standing FAQs,
policies, announcements, clarifications the firm wants the assistant to know
but does not publish as a page. Both sources feed one Qdrant collection, tagged
by origin, so retrieval stays unified while authorship stays single-source.

**Vectors are not stored here.** PostgreSQL holds the authoritative document
state; Qdrant holds the embeddings. The link is `document_id` + `version` in
the point payload, which is what makes deletion and reindexing safe: the
service can always ask "which vectors belong to version 3 of document 7" and
remove exactly those.

**Versions are immutable.** Editing a published document creates a new version
rather than mutating the old one, so a bad edit can be traced and reverted, and
so an in-flight indexing job can never find the content changed underneath it.
"""

from __future__ import annotations

import hashlib

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


def content_hash(title: str, content: str) -> str:
    """Stable fingerprint of what would be indexed.

    Covers the title as well as the body because the title is prefixed onto
    every chunk before embedding — a title-only edit genuinely changes the
    vectors and must not be mistaken for a no-op.
    """
    digest = hashlib.sha256()
    digest.update(title.strip().encode("utf-8"))
    digest.update(b"\x00")
    digest.update(content.strip().encode("utf-8"))
    return digest.hexdigest()


class Status(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class IndexStatus(models.TextChoices):
    """Where a document stands with Qdrant, denormalised onto the document.

    Derivable from the job history, and stored anyway. The admin list filters
    and sorts on it, and answering "show me everything that failed to index"
    from a correlated subquery over jobs would be a join per row on the one
    screen that must stay fast. The job table remains the audit trail; this is
    the current-state cache, written only by ``services.py``.
    """

    NEVER = "never", "Never indexed"
    QUEUED = "queued", "Queued"
    PROCESSING = "processing", "Indexing"
    INDEXED = "indexed", "Indexed"
    FAILED = "failed", "Failed"


class Category(models.TextChoices):
    """Mirrors the categories the AI service already assigns to site content.

    Kept aligned so that a retrieval filter means the same thing regardless of
    which source a chunk came from.
    """

    FIRM = "firm", "Firm"
    PRACTICE_AREA = "practice-area", "Practice area"
    FAQ = "faq", "FAQ"
    TEAM = "team", "Team"
    RECOGNITION = "recognition", "Recognition"
    CONTACT = "contact", "Contact"
    POLICY = "policy", "Policy"


class KnowledgeDocument(models.Model):
    """One editable unit of knowledge, and its lifecycle."""

    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.FAQ)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)

    # Where this came from, if it mirrors something public. Informational only —
    # it never causes a fetch, so it cannot become an SSRF vector.
    source_url = models.URLField(blank=True)

    # The version whose content is live. Null until first publish. Kept as a
    # pointer rather than a boolean on the version so that "what is published"
    # is a single unambiguous fact.
    published_version = models.ForeignKey(
        "KnowledgeVersion",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="published_for",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    # When Qdrant last confirmed it had written this document's vectors. Set
    # from the indexer's own read-back count, never optimistically on request.
    indexed_at = models.DateTimeField(null=True, blank=True)
    indexing_status = models.CharField(
        max_length=16, choices=IndexStatus.choices, default=IndexStatus.NEVER, db_index=True
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["status", "category"]),
            models.Index(fields=["indexing_status"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)[:220] or "document"
        return super().save(*args, **kwargs)

    @property
    def is_public(self) -> bool:
        """Whether the chatbot may retrieve this.

        Both conditions are required. A document can be marked published and
        still have no indexed version if indexing failed, and treating that as
        public would mean the admin sees "published" while the assistant knows
        nothing about it.
        """
        return self.status == Status.PUBLISHED and self.published_version_id is not None

    @property
    def is_stale(self) -> bool:
        """Whether edits exist that visitors are not seeing yet.

        A published document whose newest version is not the published one. Not
        an error — that is exactly what editing a live document is supposed to
        do — but it is the state an admin most often loses track of, because
        the list says "Published" and the content they just wrote is nowhere in
        the assistant's answers.
        """
        latest = self.latest_version
        return bool(
            self.status == Status.PUBLISHED
            and latest is not None
            and self.published_version_id != latest.pk
        )

    @property
    def latest_version(self) -> "KnowledgeVersion | None":
        return self.versions.order_by("-version").first()

    def next_version_number(self) -> int:
        latest = self.latest_version
        return (latest.version + 1) if latest else 1


class KnowledgeVersion(models.Model):
    """An immutable snapshot of a document's content.

    Never edited after creation. Editing produces a new row, which is what
    makes history real rather than decorative, and what stops an indexing job
    from racing an edit.
    """

    document = models.ForeignKey(KnowledgeDocument, on_delete=models.CASCADE, related_name="versions")
    version = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content = models.TextField()
    # Idempotency key. Re-publishing identical content is a no-op rather than a
    # re-embed, which matters because embedding costs money per call.
    content_hash = models.CharField(max_length=64, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(fields=["document", "version"], name="unique_document_version")
        ]

    def __str__(self) -> str:
        return f"{self.document.slug} v{self.version}"

    def save(self, *args, **kwargs):
        if not self.content_hash:
            self.content_hash = content_hash(self.title, self.content)
        return super().save(*args, **kwargs)


class JobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    PROCESSING = "processing", "Processing"
    COMPLETED = "completed", "Completed"
    FAILED = "failed", "Failed"


class IngestionJob(models.Model):
    """One attempt to make Qdrant agree with a document version.

    Recorded rather than inferred. "Did indexing succeed" is not answerable
    from the document row alone, and a system that marks a document indexed
    without evidence is one that will eventually claim the assistant knows
    something it has never been told.
    """

    document = models.ForeignKey(KnowledgeDocument, on_delete=models.CASCADE, related_name="jobs")
    version = models.ForeignKey(KnowledgeVersion, on_delete=models.CASCADE, related_name="jobs")
    status = models.CharField(max_length=16, choices=JobStatus.choices, default=JobStatus.QUEUED, db_index=True)

    chunks_indexed = models.PositiveIntegerField(default=0)
    # Operator-facing. Never rendered to a public visitor.
    error = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # At most one live job per document. Two admins hitting Reindex at
            # the same moment would otherwise race: both delete the old vectors,
            # both write new ones, and whichever finishes second leaves the
            # count doubled or the collection half-written.
            models.UniqueConstraint(
                fields=["document"],
                condition=models.Q(status__in=["queued", "processing"]),
                name="one_active_job_per_document",
            )
        ]

    def __str__(self) -> str:
        return f"{self.document.slug} v{self.version.version} — {self.status}"

    def mark_started(self) -> None:
        self.status = JobStatus.PROCESSING
        self.started_at = timezone.now()
        self.save(update_fields=["status", "started_at"])

    def mark_completed(self, chunks: int) -> None:
        self.status = JobStatus.COMPLETED
        self.chunks_indexed = chunks
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "chunks_indexed", "finished_at"])

    def mark_failed(self, error: str) -> None:
        self.status = JobStatus.FAILED
        # Truncated: an upstream traceback can be long and this column is read
        # in a list view.
        self.error = error[:2000]
        self.finished_at = timezone.now()
        self.save(update_fields=["status", "error", "finished_at"])


from django.db.models.signals import post_delete
from django.dispatch import receiver

@receiver(post_delete, sender=KnowledgeDocument)
def on_knowledge_document_deleted(sender, instance, **kwargs):
    """Ensure vectors are removed from Qdrant when a document is hard-deleted."""
    try:
        from .tasks import delete_vectors
        delete_vectors.delay(instance.pk)
    except Exception:
        pass
