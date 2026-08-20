// Create and edit a knowledge document, and control what is live.
//
// Two rules shape this screen.
//
// **Saving is not publishing.** Save Draft writes a new version and changes
// nothing the assistant can see; Publish is a separate, explicit press that
// runs an indexing job and can fail. §27 asks for no accidental publication,
// and the way to get that is not a confirmation dialog — it is never putting
// the two on the same button.
//
// **Unsaved edits are visible as such.** The banner and the disabled Publish
// button exist because the most confusing possible state is an admin editing
// text, pressing Publish, and publishing the version they had before.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, ConfirmButton, Field, StatusPill, formatDate } from '../components/Primitives.jsx';
import {
  createDocument,
  deleteDocument,
  documentAction,
  extractText,
  fetchChunks,
  getDocument,
  listVersions,
  updateDocument,
} from '../lib/adminApi.js';

const CATEGORIES = ['firm', 'practice-area', 'faq', 'team', 'recognition', 'contact', 'policy', 'all-sections'];

const EMPTY = { title: '', content: '', category: 'faq', source_url: '' };

export default function KnowledgeEditor() {
  const { id } = useParams();
  const isNew = id === undefined;
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [versions, setVersions] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [chunks, setChunks] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const body = await getDocument(id);
      setDoc(body);
      setForm({
        title: body.title,
        content: body.content,
        category: body.category,
        source_url: body.source_url || '',
      });
      const history = await listVersions(id);
      setVersions(history.results);
    } catch (err) {
      setError(err.message);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  // While a worker holds this document, re-read it until it reaches a terminal
  // state.
  //
  // Polls only when there is something to wait for, and stops the moment there
  // is not — an admin who leaves this page open on an idle document should not
  // be generating a request every two seconds forever. The interval is cleared
  // on unmount and whenever the status changes, so navigating away mid-index
  // leaves nothing running.
  const indexing = doc?.indexing_status;
  const pending = indexing === 'queued' || indexing === 'processing';

  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [pending, load]);

  // Reports the outcome once, when the document leaves the pending state. Kept
  // separate from the poll so the message is driven by what the server now says
  // rather than by what the button optimistically assumed.
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) {
      wasPending.current = true;
      return;
    }
    if (!wasPending.current) return;
    wasPending.current = false;

    if (indexing === 'indexed') {
      const chunks = doc?.last_job?.chunks_indexed;
      setNotice(
        chunks
          ? `Indexed. ${chunks} ${chunks === 1 ? 'chunk is' : 'chunks are'} now retrievable.`
          : 'Indexed.'
      );
    } else if (indexing === 'failed') {
      setError(doc?.last_job?.error || 'Indexing failed. See the job history below.');
    }
  }, [pending, indexing, doc]);

  // Compared against the loaded document rather than tracked with a dirty flag,
  // so it stays correct after a save reloads the record.
  const dirty =
    !isNew &&
    doc &&
    (form.title !== doc.title ||
      form.content !== doc.content ||
      form.category !== doc.category ||
      (form.source_url || '') !== (doc.source_url || ''));

  const behindLive =
    doc && doc.published_version !== null && doc.published_version !== doc.version;

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function run(label, action) {
    setError('');
    setNotice('');
    setBusy(label);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const save = () =>
    run('save', async () => {
      if (isNew) {
        const created = await createDocument(form);
        // Replaces the /new URL so Back does not return to an empty form that
        // would create a second document.
        navigate(`/admin/knowledge/${created.id}`, { replace: true });
        return;
      }
      await updateDocument(id, form);
      await load();
      setNotice('Draft saved. It is not live until you publish.');
    });

  const act = (action, message) =>
    run(action, async () => {
      const result = await documentAction(id, action);
      await load();

      // `queued` means a Celery worker took the job and the outcome is not
      // known yet. Saying "Published." here would be a claim the server has not
      // made — the effect below watches for the real result.
      if (result?.queued) {
        setNotice('Queued for indexing. This page will update when the worker finishes.');
        return;
      }

      setNotice(
        result?.chunks_indexed
          ? `${message} ${result.chunks_indexed} chunk${result.chunks_indexed === 1 ? '' : 's'} indexed.`
          : message
      );
    });

  const remove = () =>
    run('delete', async () => {
      await deleteDocument(id);
      navigate('/admin/knowledge', { replace: true });
    });

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-populate title from filename if title is empty
      if (!form.title.trim()) {
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
        set('title', cleanName);
      }
    } else {
      setSelectedFile(null);
    }
  };

  const handleExtract = () => {
    if (!selectedFile) return;
    run('extract', async () => {
      const result = await extractText(selectedFile);
      set('content', result.text);
      setNotice(`Extracted text from "${selectedFile.name}". Review the document title, category, and extracted content below.`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });
  };

  const loadChunks = () => {
    run('chunks', async () => {
      const data = await fetchChunks(id);
      setChunks(data.chunks || []);
    });
  };

  const canSave = form.title.trim() && form.content.trim() && !busy;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{isNew ? 'Upload Knowledge Document' : doc?.title || 'Document'}</h1>
          {doc ? (
            <p className="adm-sub">
              <StatusPill status={doc.status} /> &nbsp;v{doc.version}
              {doc.published_version && ` · v${doc.published_version} live`}
              {doc.published_at && ` · published ${formatDate(doc.published_at)}`}
            </p>
          ) : (
            <p className="adm-sub">Upload a PDF, Word (DOCX), or Text file to import knowledge into the AI assistant.</p>
          )}
        </div>
        <button className="adm-btn" onClick={() => navigate('/admin/knowledge')}>
          Back to list
        </button>
      </div>

      <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>
      <Alert kind="ok" onDismiss={() => setNotice('')}>{notice}</Alert>

      {dirty && (
        <Alert kind="info">You have unsaved changes. Save the draft before publishing.</Alert>
      )}
      {!dirty && behindLive && (
        <Alert kind="info">
          v{doc.version} is saved but not live — visitors still see v{doc.published_version}. Publish to
          make it current.
        </Alert>
      )}
      {pending && (
        <Alert kind="info">
          {indexing === 'queued'
            ? 'Queued — waiting for an indexing worker.'
            : 'Indexing in progress…'}{' '}
          You can leave this page; the work continues on the worker.
        </Alert>
      )}
      {!pending && doc?.last_job?.status === 'failed' && (
        <Alert kind="error">Last indexing job failed: {doc.last_job.error}</Alert>
      )}

      {/* EXCLUSIVE METHOD: DOCUMENT FILE UPLOAD & AI PROCESSING */}
      <div className="adm-card adm-card-pad" style={{ border: '1px solid var(--adm-line-gold)', background: 'linear-gradient(158deg, rgba(20, 22, 32, 0.95) 0%, rgba(10, 11, 17, 0.98) 100%)' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <strong style={{ fontSize: '1.15rem', color: 'var(--adm-gold-soft)', display: 'block', marginBottom: '0.35rem' }}>
            📁 Knowledge Document Importer (PDF / DOCX / TXT / MD)
          </strong>
          <span className="adm-cell-muted">
            Upload your legal reference document, FAQ list, practice domain file, or firm policy. The system extracts text automatically and prepares it for AI chatbot retrieval.
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <input 
            type="file" 
            className="adm-input" 
            style={{ flex: 1, minWidth: '280px', padding: '0.75rem 1rem' }}
            onChange={handleFileSelect}
            accept=".pdf,.docx,.txt,.md"
            ref={fileInputRef}
          />
          <button 
            className="adm-btn is-primary" 
            onClick={handleExtract}
            disabled={!selectedFile || busy === 'extract'}
            style={{ minWidth: '180px', padding: '0.8rem 1.4rem' }}
          >
            {busy === 'extract' ? 'Extracting Text…' : 'Extract Document Text'}
          </button>
        </div>

        <Field label="Document Title">
          <input
            className="adm-input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Document title (Auto-generated from file name upon upload)"
            maxLength={200}
          />
        </Field>

        <Field label="Knowledge Category" hint="Determines how the RAG chatbot classifies and retrieves this information.">
          <select
            className="adm-select"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>

        <Field
          label="Source URL (Optional)"
          hint="Cites this page link when the RAG chatbot answers visitors."
        >
          <input
            className="adm-input"
            value={form.source_url}
            onChange={(e) => set('source_url', e.target.value)}
            placeholder="/practice/civil-litigation"
          />
        </Field>

        <Field
          label="Extracted Document Content"
          hint="Content extracted from your document file. Ready for indexing into the RAG vector store."
        >
          <textarea
            className="adm-textarea"
            style={{ minHeight: '280px', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', lineHeight: '1.6' }}
            value={form.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Upload a document file above to extract and view its text content here…"
          />
        </Field>

        <div className="adm-row" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--adm-line-soft)' }}>
          <button className="adm-btn" onClick={save} disabled={!canSave}>
            {busy === 'save' ? 'Saving…' : 'Save Draft'}
          </button>

          {!isNew && (
            <>
              <button
                className="adm-btn is-primary"
                onClick={() => act('publish', 'Published & Indexed for RAG Chatbot.')}
                disabled={!!busy || dirty}
                title={dirty ? 'Save changes first before publishing' : undefined}
              >
                {busy === 'publish' ? 'Publishing to RAG…' : 'Publish to RAG Chatbot'}
              </button>

              {doc?.status === 'published' && (
                <>
                  <button
                    className="adm-btn"
                    onClick={() => act('reindex', 'Re-indexed.')}
                    disabled={!!busy}
                  >
                    {busy === 'reindex' ? 'Re-indexing…' : 'Re-index Vectors'}
                  </button>
                  <button
                    className="adm-btn"
                    onClick={() => act('unpublish', 'Unpublished. Vectors removed from RAG.')}
                    disabled={!!busy}
                  >
                    {busy === 'unpublish' ? 'Unpublishing…' : 'Unpublish'}
                  </button>
                </>
              )}

              <span className="adm-spacer" />

              <ConfirmButton
                className="adm-btn"
                style={{ color: 'var(--adm-danger)', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                onConfirm={remove}
                disabled={!!busy}
              >
                {busy === 'delete' ? 'Deleting…' : 'Delete Document'}
              </ConfirmButton>
            </>
          )}
        </div>
      </div>





      {versions.length > 0 && (
        <div className="adm-card" style={{ marginTop: '1.25rem' }}>
          <div className="adm-card-pad">
            <div className="adm-row">
              <strong>Version history</strong>
              <span className="adm-spacer" />
              {/* The full-page view for when this inline table is the thing
                  being read rather than a footnote to the editor. */}
              <Link className="adm-btn is-small" to={`/admin/knowledge/${id}/versions`}>
                Open full history
              </Link>
            </div>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Excerpt</th>
                  <th>By</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.version}>
                    <td>
                      v{version.version}
                      {version.version === doc?.published_version && (
                        <span className="adm-pill is-published" style={{ marginLeft: '0.4rem' }}>live</span>
                      )}

                    </td>
                    <td className="adm-cell-muted">{version.title}</td>
                    <td className="adm-cell-muted">{version.excerpt.slice(0, 70)}…</td>
                    <td className="adm-cell-muted">{version.created_by || '—'}</td>
                    <td className="adm-cell-muted">{formatDate(version.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {doc?.status === 'published' && (
        <div className="adm-card" style={{ marginTop: '1.25rem' }}>
          <div className="adm-card-pad">
            <div className="adm-row">
              <strong>Vector Chunks</strong>
              <span className="adm-spacer" />
              <button 
                className="adm-btn is-small" 
                onClick={loadChunks}
                disabled={busy === 'chunks'}
              >
                {chunks ? 'Refresh Chunks' : 'Load Chunks'}
              </button>
            </div>
            {chunks && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {chunks.map((c, i) => (
                  <div key={i} style={{ padding: '0.75rem', background: 'var(--bg-inset, #f3f4f6)', borderRadius: '4px', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
                    {c.text}
                  </div>
                ))}
                {chunks.length === 0 && <p className="adm-cell-muted">No chunks found. Vector database might be out of sync.</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
