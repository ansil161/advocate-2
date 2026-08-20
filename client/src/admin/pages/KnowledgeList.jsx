// The knowledge base index: search, filter, and see what is actually live.
//
// "Live" is its own column rather than being inferred from Status, because the
// two can disagree — a document can be marked published while its indexing job
// failed. Showing only Status would hide exactly the case an admin most needs
// to see.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Empty, StatusPill, formatDate } from '../components/Primitives.jsx';
import { listDocuments } from '../lib/adminApi.js';

const CATEGORIES = ['', 'firm', 'practice-area', 'faq', 'team', 'recognition', 'contact', 'policy', 'all-sections'];
const STATUSES = ['', 'draft', 'published'];
const INDEX_STATUSES = ['', 'never', 'queued', 'processing', 'indexed'];


export default function KnowledgeList() {
  const [filters, setFilters] = useState({
    q: '',
    status: '',
    category: '',
    indexStatus: '',
    updatedSince: '',
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    listDocuments({ ...filters, page })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [filters, page]);

  useEffect(() => {
    // Debounced so typing in the search box does not fire a request per
    // keystroke. 250ms is below the point where the list feels laggy and well
    // above a fast typist's inter-key interval.
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function setFilter(key, value) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  const results = data?.results ?? [];
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">Knowledge base</h1>
          <p className="adm-sub">
            Documents the assistant can retrieve. Site pages are managed in the codebase and are not
            listed here.
          </p>
        </div>
        <Link className="adm-btn is-primary" to="/admin/knowledge/new">
          New document
        </Link>
      </div>

      <Alert kind="error">{error}</Alert>

      <div className="adm-card adm-card-pad" style={{ marginBottom: '1.1rem' }}>
        <div className="adm-row">
          <input
            className="adm-input"
            style={{ maxWidth: 260 }}
            placeholder="Search title or slug…"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            aria-label="Search documents"
          />
          <select
            className="adm-select"
            style={{ maxWidth: 160 }}
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
            aria-label="Filter by status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
          <select
            className="adm-select"
            style={{ maxWidth: 180 }}
            value={filters.category}
            onChange={(e) => setFilter('category', e.target.value)}
            aria-label="Filter by category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c || 'All categories'}</option>
            ))}
          </select>
          <select
            className="adm-select"
            style={{ maxWidth: 180 }}
            value={filters.indexStatus}
            onChange={(e) => setFilter('indexStatus', e.target.value)}
            aria-label="Filter by index status"
          >
            {INDEX_STATUSES.map((s) => (
              <option key={s} value={s}>{s ? `Index: ${s}` : 'Any index state'}</option>
            ))}
          </select>
          <input
            type="date"
            className="adm-input"
            style={{ maxWidth: 170 }}
            value={filters.updatedSince}
            onChange={(e) => setFilter('updatedSince', e.target.value)}
            aria-label="Updated on or after"
            title="Updated on or after"
          />
          <span className="adm-spacer" />
          {data && <span className="adm-cell-muted">{data.total} total</span>}
        </div>
      </div>

      <div className="adm-card">
        <div className="adm-table-wrap">
          {!data ? (
            <Empty>Loading…</Empty>
          ) : results.length === 0 ? (
            <Empty>No documents match those filters.</Empty>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Live</th>
                  <th>Index</th>
                  <th>Version</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((doc) => (
                  <tr key={doc.id}>
                    <td className="adm-cell-title">
                      <Link to={`/admin/knowledge/${doc.id}`}>{doc.title}</Link>
                      <div className="adm-cell-muted">{doc.slug}</div>
                    </td>
                    <td className="adm-cell-muted">{doc.category}</td>
                    <td><StatusPill status={doc.status} /></td>
                    <td>
                      {doc.is_public ? (
                        <span className="adm-pill is-published">
                          <i className="adm-pill-dot" aria-hidden="true" />retrievable
                        </span>
                      ) : (
                        <span className="adm-cell-muted">no</span>
                      )}
                    </td>
                    <td>
                      {/* Distinct from Status and from Live: a document can be
                          published with a failed index, and that is the row an
                          admin must be able to spot. */}
                      <StatusPill
                        status={
                          doc.indexing_status === 'indexed'
                            ? 'completed'
                            : doc.indexing_status === 'failed'
                              ? 'failed'
                              : 'queued'
                        }
                      />
                      {doc.is_stale && (
                        <div className="adm-cell-muted" title="Edited since it was last published">
                          stale
                        </div>
                      )}
                    </td>
                    <td className="adm-cell-muted">
                      v{doc.version}
                      {/* An edit that has not been published yet — the live
                          version is behind the latest one. */}
                      {doc.published_version && doc.published_version !== doc.version && (
                        <span title={`v${doc.published_version} is live`}> (v{doc.published_version} live)</span>
                      )}
                    </td>
                    <td className="adm-cell-muted">{formatDate(doc.updated_at)}</td>
                    <td className="adm-cell-actions">
                      <Link className="adm-btn is-small" to={`/admin/knowledge/${doc.id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="adm-row" style={{ marginTop: '1rem' }}>
          <button className="adm-btn is-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span className="adm-cell-muted">Page {page} of {pageCount}</span>
          <button
            className="adm-btn is-small"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </>
  );
}
