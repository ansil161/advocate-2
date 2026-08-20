"""Text extraction utilities for uploaded files in Django admin."""

def extract_file_text(file_obj, filename: str) -> str:
    """Extract plain text from uploaded file (PDF, DOCX, TXT, MD)."""
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext in ["txt", "md"]:
        try:
            return file_obj.read().decode("utf-8", errors="ignore")
        except Exception:
            return ""

    if ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_obj)
            return "\n\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception:
            try:
                import PyPDF2
                reader = PyPDF2.PdfReader(file_obj)
                return "\n\n".join([page.extract_text() or "" for page in reader.pages])
            except Exception:
                return ""

    if ext == "docx":
        try:
            import docx
            doc = docx.Document(file_obj)
            return "\n\n".join([p.text for p in doc.paragraphs if p.text])
        except Exception:
            return ""

    try:
        return file_obj.read().decode("utf-8", errors="ignore")
    except Exception:
        return ""
