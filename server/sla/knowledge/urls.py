"""Admin knowledge-base routes.

Mounted under ``/api/admin/`` so that the public and administrative surfaces
are separable at the edge — a reverse proxy or WAF can restrict the whole
prefix by source address without knowing anything about individual views.
"""

from django.urls import path

from account.views import AdminEnquiryListView, AdminEnquiryDetailView
from .views import (
    BulkReindexView,
    DashboardView,
    DocumentActionView,
    DocumentChunksView,
    DocumentDetailView,
    DocumentExtractView,
    DocumentListView,
    DocumentVersionsView,
    JobListView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="admin-dashboard"),
    path("jobs/", JobListView.as_view(), name="admin-jobs"),
    path("enquiries/", AdminEnquiryListView.as_view(), name="admin-enquiry-list"),
    path("enquiries/<int:pk>/", AdminEnquiryDetailView.as_view(), name="admin-enquiry-detail"),
    # Declared before the <int:pk> routes so "reindex-all" is never parsed as a
    # document id.
    path("knowledge/reindex-all/", BulkReindexView.as_view(), name="admin-knowledge-reindex-all"),
    path("knowledge/", DocumentListView.as_view(), name="admin-knowledge-list"),
    path("knowledge/extract/", DocumentExtractView.as_view(), name="admin-knowledge-extract"),
    path("knowledge/<int:pk>/", DocumentDetailView.as_view(), name="admin-knowledge-detail"),
    path("knowledge/<int:pk>/chunks/", DocumentChunksView.as_view(), name="admin-knowledge-chunks"),
    path("knowledge/<int:pk>/versions/", DocumentVersionsView.as_view(), name="admin-knowledge-versions"),
    # Actions are POST-only verbs rather than PATCHes of a status field: publishing
    # runs an indexing job and can fail upstream, which is not what a field update
    # should be able to do.
    path("knowledge/<int:pk>/<str:action>/", DocumentActionView.as_view(), name="admin-knowledge-action"),
]

