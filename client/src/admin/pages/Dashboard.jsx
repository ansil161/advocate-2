// Dashboard: what state the knowledge base is in, and what indexing has done.
//
// The two numbers that matter are Published and Indexed, and they are shown
// side by side on purpose. When they disagree, some document says it is live
// while the assistant cannot retrieve it — which is the failure the whole
// publish path is built to prevent, and the one worth noticing from across the
// room rather than discovering from a visitor.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Empty, StatusPill, formatDate } from '../components/Primitives.jsx';
import { fetchDashboard, listEnquiries } from '../lib/adminApi.js';

function Stat({ label, value, warn }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-label">{label}</div>
      <div className={`adm-stat-value${warn ? ' is-warn' : ''}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [enquiryCounts, setEnquiryCounts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDashboard(), listEnquiries({ page: 1 }).catch(() => null)])
      .then(([body, enquiriesRes]) => {
        if (!cancelled) {
          setData(body);
          if (enquiriesRes?.counts) setEnquiryCounts(enquiriesRes.counts);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Empty>Loading…</Empty>;

  const { documents, recent_jobs: recent } = data;
  // Published-but-not-indexed is the inconsistency worth flagging.
  const drift = documents.published - documents.indexed;

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">Dashboard</h1>
          <p className="adm-sub">Overview of client enquiries, knowledge base, and indexing status</p>
        </div>
      </div>

      {drift > 0 && (
        <Alert kind="error">
          {drift} published {drift === 1 ? 'document is' : 'documents are'} not indexed — the assistant
          cannot retrieve {drift === 1 ? 'it' : 'them'}. Re-index from the document page.
        </Alert>
      )}

      <div className="adm-stats">
        <Stat label="Documents" value={documents.total} />
        <Stat label="Published" value={documents.published} />
        <Stat label="Indexed" value={documents.indexed} warn={drift > 0} />
        <Stat label="Total Enquiries" value={enquiryCounts?.total ?? '—'} />
        <Stat label="New Enquiries" value={enquiryCounts?.new ?? '—'} warn={Boolean(enquiryCounts?.new > 0)} />
      </div>

      {enquiryCounts?.new > 0 && (
        <div className="adm-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #3b82f6', background: 'rgba(59, 130, 246, 0.05)' }}>
          <div className="adm-card-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{enquiryCounts.new} new client {enquiryCounts.new === 1 ? 'enquiry' : 'enquiries'} waiting</strong>
              <div style={{ fontSize: '0.85rem', color: 'var(--adm-muted)' }}>Visitors submitted consultation requests that need review.</div>
            </div>
            <Link to="/admin/enquiries" className="adm-btn is-primary is-small">View Enquiries</Link>
          </div>
        </div>
      )}



      <div className="adm-card">
        <div className="adm-card-pad">
          <strong>Recent indexing jobs</strong>
        </div>
        <div className="adm-table-wrap">
          {recent.length === 0 ? (
            <Empty>Nothing has been indexed yet.</Empty>
          ) : (
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Finished</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((job) => (
                  <tr key={job.id}>
                    <td className="adm-cell-title">{job.document}</td>
                    <td className="adm-cell-muted">v{job.version}</td>
                    <td><StatusPill status={job.status} /></td>
                    <td>{job.chunks_indexed || '—'}</td>
                    <td className="adm-cell-muted">{formatDate(job.finished_at)}</td>
                    {/* Truncated rather than wrapped: an upstream error can be a
                        paragraph, and one failure should not push the rest of
                        the table off the screen. The editor shows it in full. */}
                    <td className="adm-cell-muted" title={job.error || ''}>
                      {job.error ? `${job.error.slice(0, 60)}…` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
