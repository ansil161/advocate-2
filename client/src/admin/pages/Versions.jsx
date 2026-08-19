// Version history for one document.
//
// Read-only on purpose. Versions are immutable snapshots — that is what makes
// the history an audit trail rather than a changelog someone can tidy — so the
// only actions this screen offers are looking, and copying old text out to
// paste into a new version. Restoring by mutating an old row would destroy the
// record of what was actually live at the time.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Empty, formatDate } from '../components/Primitives.jsx';
import { getDocument, listVersions } from '../lib/adminApi.js';

export default function Versions() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDocument(id), listVersions(id)])
      .then(([doc, versions]) => {
        if (cancelled) return;
        setDocument(doc);
        setData(versions);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Empty>Loading…</Empty>;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">Version history</h1>
          <p className="adm-sub">{document?.title}</p>
        </div>
        <Link className="adm-btn" to={`/admin/knowledge/${id}`}>Back to document</Link>
      </div>

      {data.published_version ? (
        <Alert kind="info">
          Version {data.published_version} is live. Editing creates a new version and does not
          change what visitors see until it is published.
        </Alert>
      ) : (
        <Alert kind="info">No version of this document is currently published.</Alert>
      )}

      {!data.results.length ? (
        <Empty>No versions yet.</Empty>
      ) : (
        <div className="adm-card">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Created</th>
                  <th>State</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.results.map((version) => (
                  <tr key={version.version}>
                    <td className="adm-cell-title">v{version.version}</td>
                    <td>{version.title}</td>
                    <td className="adm-cell-muted">{version.created_by || '—'}</td>
                    <td className="adm-cell-muted">{formatDate(version.created_at)}</td>
                    <td className="adm-cell-muted">
                      {version.version === data.published_version ? 'Live' : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="adm-btn is-small"
                        onClick={() =>
                          setOpen(open === version.version ? null : version.version)
                        }
                      >
                        {open === version.version ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {open !== null && (
            <div className="adm-card-pad">
              <strong>v{open} excerpt</strong>
              <pre className="adm-pre">
                {data.results.find((v) => v.version === open)?.excerpt}
              </pre>
              <div className="adm-hint">
                Truncated — version history is for scanning. The current content is on the document
                page.
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
