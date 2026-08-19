"""Django admin registration.

A convenience for operators, not the product — the custom panel is the intended
interface. Registered anyway because a superuser needs some way to inspect and
repair state when the SPA is broken or mid-deploy.

Publishing is deliberately absent from here. It runs an indexing job that can
fail upstream, and Django admin's bulk actions would let someone publish twenty
documents with one click and no way to see which of them actually reached
Qdrant.
"""

from django.contrib import admin
from django import forms
from django.core.exceptions import ValidationError

from .models import IngestionJob, KnowledgeDocument, KnowledgeVersion
from .services import create_version
from .parsers import extract_file_text


class KnowledgeDocumentForm(forms.ModelForm):
    upload_file = forms.FileField(
        required=False,
        help_text="Upload a PDF, DOCX, or TXT file to automatically extract content. If uploaded, a new version will be created with the extracted text."
    )

    class Meta:
        model = KnowledgeDocument
        fields = "__all__"

    def clean_upload_file(self):
        file_obj = self.cleaned_data.get("upload_file")
        if file_obj:
            ext = file_obj.name.lower().split('.')[-1]
            if ext not in ["pdf", "docx", "txt"]:
                raise ValidationError(f"Unsupported file format: .{ext}")
        return file_obj


class KnowledgeVersionInline(admin.TabularInline):
    model = KnowledgeVersion
    extra = 0
    # Versions are immutable by design; making them editable here would let the
    # admin site do what the rest of the system forbids.
    readonly_fields = ("version", "title", "content_hash", "created_at", "created_by")
    fields = readonly_fields
    can_delete = False
    ordering = ("-version",)

    def has_add_permission(self, request, obj=None) -> bool:
        return False


@admin.register(KnowledgeDocument)
class KnowledgeDocumentAdmin(admin.ModelAdmin):
    form = KnowledgeDocumentForm
    list_display = ("title", "category", "status", "is_public", "published_at", "updated_at")
    list_filter = ("status", "category")
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}
    readonly_fields = ("published_version", "published_at", "created_at", "updated_at")
    inlines = [KnowledgeVersionInline]

    @admin.display(boolean=True, description="Live")
    def is_public(self, obj: KnowledgeDocument) -> bool:
        return obj.is_public

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        
        upload_file = form.cleaned_data.get("upload_file")
        if upload_file:
            try:
                # Extract text from the uploaded file
                extracted_text = extract_file_text(upload_file, upload_file.name)
                
                # Create a new version with the extracted text
                if extracted_text.strip():
                    create_version(
                        document=obj,
                        title=obj.title,
                        content=extracted_text,
                        user=request.user
                    )
            except Exception as e:
                from django.contrib import messages
                messages.error(request, f"Failed to parse the uploaded file: {str(e)}")


@admin.register(IngestionJob)
class IngestionJobAdmin(admin.ModelAdmin):
    list_display = ("document", "version", "status", "chunks_indexed", "created_at", "finished_at")
    list_filter = ("status",)
    readonly_fields = tuple(f.name for f in IngestionJob._meta.fields)

    def has_add_permission(self, request) -> bool:
        # Jobs are a record of what happened, not something to author.
        return False
