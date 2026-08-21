import { useCallback, useEffect, useState } from 'react';
import { Alert, ConfirmButton, Empty, StatusPill, formatDate } from '../components/Primitives.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { deleteEnquiry, listEnquiries, updateEnquiry } from '../lib/adminApi.js';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

export default function Enquiries() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Selected enquiry for detail modal
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setError('');
    listEnquiries({ status: statusFilter, q: searchQuery, page })
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to load enquiries');
        setLoading(false);
      });
  }, [statusFilter, searchQuery, page]);

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function handleStatusChange(id, newStatus) {
    setUpdatingId(id);
    setError('');
    try {
      const res = await updateEnquiry(id, { status: newStatus });
      setSuccessMsg(`Status updated to ${newStatus}`);
      setTimeout(() => setSuccessMsg(''), 3000);

      // Update in local data
      setData(prev => {
        if (!prev) return prev;
        const updatedList = prev.enquiries.map(item =>
          item.id === id ? { ...item, status: newStatus } : item
        );
        return { ...prev, enquiries: updatedList };
      });

      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      setError(err.message || 'Failed to update enquiry status');
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id) {
    setUpdatingId(id);
    setError('');
    try {
      await deleteEnquiry(id);
      setSuccessMsg('Enquiry deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      if (selectedEnquiry?.id === id) {
        setSelectedEnquiry(null);
      }
      loadData();
    } catch (err) {
      setError(err.message || 'Failed to delete enquiry');
    } finally {
      setUpdatingId(null);
    }
  }

  const enquiries = data?.enquiries ?? [];
  const counts = data?.counts ?? { total: 0, new: 0, contacted: 0, resolved: 0, archived: 0 };
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="adm-page-enquiries">
      <div className="adm-head">
        <div>
          <h1 className="adm-title">Client Enquiries</h1>
          <p className="adm-sub">
            Review and manage consultation requests submitted across website contact forms.
          </p>
        </div>
      </div>

      {error && <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>}
      {successMsg && <Alert kind="info" onDismiss={() => setSuccessMsg('')}>{successMsg}</Alert>}

      {/* Metrics Cards */}
      <div className="adm-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="adm-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--adm-bg-surface, rgba(255,255,255,0.03))', border: '1px solid var(--adm-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--adm-muted, #888)', marginBottom: '0.25rem' }}>Total Enquiries</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600 }}>{counts.total}</div>
        </div>
        <div className="adm-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--adm-bg-surface, rgba(255,255,255,0.03))', border: '1px solid var(--adm-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.85rem', color: '#60a5fa', marginBottom: '0.25rem' }}>New Requests</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#60a5fa' }}>{counts.new}</div>
        </div>
        <div className="adm-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--adm-bg-surface, rgba(255,255,255,0.03))', border: '1px solid var(--adm-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.85rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Contacted</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#f59e0b' }}>{counts.contacted}</div>
        </div>
        <div className="adm-card" style={{ padding: '1.25rem', borderRadius: '12px', background: 'var(--adm-bg-surface, rgba(255,255,255,0.03))', border: '1px solid var(--adm-border, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '0.25rem' }}>Resolved</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#10b981' }}>{counts.resolved}</div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="adm-toolbar">
        <div className="adm-search">
          <input
            type="search"
            placeholder="Search by name, email, phone, matter..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            className="adm-input"
          />
        </div>

        <div className="adm-filters" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`adm-btn is-small ${statusFilter === opt.value ? 'is-primary' : 'is-ghost'}`}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            >
              {opt.label}
              {opt.value === 'new' && counts.new > 0 && (
                <span style={{ marginLeft: '6px', background: '#3b82f6', color: '#fff', padding: '1px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                  {counts.new}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Enquiries Table */}
      {loading && enquiries.length === 0 ? (
        <Empty>Loading enquiries...</Empty>
      ) : enquiries.length === 0 ? (
        <Empty>No client enquiries found matching your criteria.</Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Client Info</th>
                <th>Matter Type</th>
                <th>Message Snippet</th>
                <th>Status</th>
                <th className="is-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map(item => (
                <tr key={item.id} className={item.status === 'new' ? 'is-unread-row' : ''}>
                  <td className="is-nowrap" style={{ fontSize: '0.85rem', color: 'var(--adm-muted)' }}>
                    {formatDate(item.created_at)}
                    <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--adm-muted)' }}>
                      <a href={`mailto:${item.email}`} style={{ color: 'inherit' }}>{item.email}</a>
                      {item.phone && ` • ${item.phone}`}
                    </div>
                  </td>
                  <td>
                    <span className="adm-tag" style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                      {item.matter}
                    </span>
                  </td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.message}
                  </td>
                  <td>
                    <select
                      value={item.status}
                      onChange={e => handleStatusChange(item.id, e.target.value)}
                      disabled={updatingId === item.id}
                      className="adm-select"
                      style={{
                        fontSize: '0.8rem',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontWeight: 500,
                        background: item.status === 'new' ? '#1e3a8a' : item.status === 'contacted' ? '#78350f' : item.status === 'resolved' ? '#064e3b' : 'rgba(255,255,255,0.05)',
                        color: item.status === 'new' ? '#93c5fd' : item.status === 'contacted' ? '#fde68a' : item.status === 'resolved' ? '#a7f3d0' : '#9ca3af',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="resolved">Resolved</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td className="is-right is-nowrap">
                    <button
                      type="button"
                      className="adm-btn is-small is-ghost"
                      onClick={() => setSelectedEnquiry(item)}
                      title="View Details"
                    >
                      View
                    </button>
                    <ConfirmButton
                      className="adm-btn is-small is-danger"
                      confirmLabel="Confirm Delete?"
                      onConfirm={() => handleDelete(item.id)}
                      disabled={updatingId === item.id}
                    >
                      Delete
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="adm-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--adm-muted)' }}>
            Page {page} of {pageCount} ({data?.total} items)
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="adm-btn is-small"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="adm-btn is-small"
              disabled={page >= pageCount}
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEnquiry && (
        <div className="adm-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="adm-modal" style={{ background: '#121316', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', maxWidth: '600px', width: '100%', padding: '1.75rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="adm-tag" style={{ background: '#3b82f6', color: '#fff', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                  {selectedEnquiry.matter}
                </span>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginTop: '0.5rem', marginBottom: '0.25rem' }}>{selectedEnquiry.name}</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--adm-muted)' }}>
                  Submitted on {formatDate(selectedEnquiry.created_at)} {selectedEnquiry.created_at ? new Date(selectedEnquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
              <button
                type="button"
                className="adm-btn is-small is-ghost"
                onClick={() => setSelectedEnquiry(null)}
                style={{ padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--adm-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email Address</div>
                <a href={`mailto:${selectedEnquiry.email}`} style={{ color: '#60a5fa', fontWeight: 500, fontSize: '0.95rem' }}>{selectedEnquiry.email}</a>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--adm-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone Number</div>
                <a href={`tel:${selectedEnquiry.phone}`} style={{ color: '#60a5fa', fontWeight: 500, fontSize: '0.95rem' }}>{selectedEnquiry.phone || 'N/A'}</a>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--adm-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
                Matter Description
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {selectedEnquiry.message}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--adm-muted)' }}>Status:</span>
                <select
                  value={selectedEnquiry.status}
                  onChange={e => handleStatusChange(selectedEnquiry.id, e.target.value)}
                  className="adm-select"
                  style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem' }}
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="resolved">Resolved</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  href={`mailto:${selectedEnquiry.email}?subject=RE: Consultation regarding ${selectedEnquiry.matter}`}
                  className="adm-btn is-primary is-small"
                  style={{ textDecoration: 'none' }}
                >
                  Reply via Email
                </a>
                <button
                  type="button"
                  className="adm-btn is-ghost is-small"
                  onClick={() => setSelectedEnquiry(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
