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
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const handleExtract = () => {
    if (!selectedFile) return;
    run('extract', async () => {
      const result = await extractText(selectedFile);
      set('content', result.text);
      setNotice('Text extracted from file. Review the content below before saving.');
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
          <h1 className="adm-title">{isNew ? 'New document' : doc?.title || 'Document'}</h1>
          {doc && (
            <p className="adm-sub">
              <StatusPill status={doc.status} /> &nbsp;v{doc.version}
              {doc.published_version && ` · v${doc.published_version} live`}
              {doc.published_at && ` · published ${formatDate(doc.published_at)}`}
            </p>
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
      {/* Suppressed while a new attempt is in flight: showing the previous
          failure beside "Indexing in progress" reads as the current one. */}
      {!pending && doc?.last_job?.status === 'failed' && (
        <Alert kind="error">Last indexing job failed: {doc.last_job.error}</Alert>
      )}

      <div className="adm-card adm-card-pad">
        <Field label="Title">
          <input
            className="adm-input"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={200}
          />
        </Field>

        <Field label="Category" hint="Used to group content and to filter retrieval.">
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
          label="Source URL"
          hint="Optional. Shown as the answer's source when the assistant cites this document."
        >
          <input
            className="adm-input"
            value={form.source_url}
            onChange={(e) => set('source_url', e.target.value)}
            placeholder="/contact#c-reach"
          />
        </Field>

        <div style={{ marginBottom: '1.25rem' }}>
          <label className="adm-label">Upload File (PDF/DOCX/TXT) to Extract Text</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input 
              type="file" 
              className="adm-input" 
              style={{ flex: 1, padding: '0.35rem 0.5rem' }}
              onChange={handleFileSelect}
              accept=".pdf,.docx,.txt"
              ref={fileInputRef}
            />
            <button 
              className="adm-btn" 
              onClick={handleExtract}
              disabled={!selectedFile || busy === 'extract'}
            >
              {busy === 'extract' ? 'Extracting…' : 'Extract'}
            </button>
          </div>
        </div>

        <Field
          label="Content"
          hint="Plain prose. Long documents are split into chunks automatically, each carrying the title."
        >
          <textarea
            className="adm-textarea"
            value={form.content}
            onChange={(e) => set('content', e.target.value)}
          />
        </Field>

        <div className="adm-row">
          <button className="adm-btn" onClick={save} disabled={!canSave}>
            {busy === 'save' ? 'Saving…' : 'Save draft'}
          </button>

          {!isNew && (
            <>
              <button
                className="adm-btn is-primary"
                onClick={() => act('publish', 'Published.')}
                // Publishing a stale version is the confusing failure this
                // prevents: save first, then publish what you just wrote.
                disabled={!!busy || dirty}
                title={dirty ? 'Save your changes first' : undefined}
              >
                {busy === 'publish' ? 'Publishing…' : 'Publish'}
              </button>

              {doc?.status === 'published' && (
                <>
                  <button
                    className="adm-btn"
                    onClick={() => act('reindex', 'Re-indexed.')}
                    disabled={!!busy}
                  >
                    {busy === 'reindex' ? 'Re-indexing…' : 'Re-index'}
                  </button>
                  <button
                    className="adm-btn"
                    onClick={() => act('unpublish', 'Unpublished. It is no longer retrievable.')}
                    disabled={!!busy}
                  >
                    Unpublish
                  </button>
                </>
              )}

              <span className="adm-spacer" />
              <ConfirmButton
                className="adm-btn is-danger"
                confirmLabel="Really delete?"
                onConfirm={remove}
                disabled={!!busy}
              >
                Delete
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
                        <> <span className="adm-pill is-published">live</span></>
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
