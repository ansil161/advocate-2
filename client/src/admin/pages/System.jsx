// System status: every upstream the assistant depends on, and how it is
// performing.
//
// Two things this page deliberately does. It reports components that are *not*
// configured — Redis, a job broker — rather than omitting them, because a
// missing row leaves an operator unable to tell "not checked" from "not
// running", and the consequences of no Redis here are real and worth stating
// where someone will read them. And it names the scope of the latency numbers:
// they come from one process's rolling window, which with multiple workers is a
// sample rather than the whole picture.
//
// Nothing here can carry a credential. The AI service's health and metrics
// endpoints return component names and states only.

import { useCallback, useEffect, useState } from 'react';
import { Alert, Empty, StatusPill } from '../components/Primitives.jsx';
import { fetchSystemStatus, listJobs, reindexAll } from '../lib/adminApi.js';

function health(value = '') {
  if (value.startsWith('ok')) return 'completed';
  if (value === 'not configured' || value === 'in-process') return 'queued';
  return 'failed';
}

function Row({ label, value, detail }) {
  return (
    <tr>
      <td className="adm-cell-title">{label}</td>
      <td><StatusPill status={health(value)} /></td>
      <td className="adm-cell-muted">{value}</td>
      <td className="adm-cell-muted">{detail || '—'}</td>
    </tr>
  );
}

function Latency({ label, stats }) {
  if (!stats) return null;
  return (
    <div className="adm-stat">
      <div className="adm-stat-label">{label}</div>
      <div className="adm-stat-value">{Math.round(stats.p50)} ms</div>
      <div className="adm-hint">
        p95 {Math.round(stats.p95)} · p99 {Math.round(stats.p99)}
      </div>
    </div>
  );
}

export default function System() {
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [system, jobList] = await Promise.all([fetchSystemStatus(), listJobs()]);
      setStatus(system);
      setJobs(jobList);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polls only while something is actually running, so an idle admin tab is not
  // making a request every few seconds forever.
  useEffect(() => {
    if (!jobs?.active) return undefined;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [jobs?.active, load]);

  async function handleReindexAll() {
    setBusy(true);
    setError('');
    try {
      const result = await reindexAll();
      setNotice(
        `Scheduled ${result.scheduled} document(s).` +
          (result.skipped_busy ? ` ${result.skipped_busy} already had a job running.` : '') +
          (result.recovered_stale ? ` Recovered ${result.recovered_stale} abandoned job(s).` : '')
      );
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !status) return <Alert kind="error">{error}</Alert>;
  if (!status) return <Empty>Loading…</Empty>;

  const ai = status.ai_service || {};
  const metrics = status.metrics || {};
  const latency = metrics.latency_ms || {};
  const totals = metrics.totals || {};

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">System</h1>
          <p className="adm-sub">Upstream health, throughput and indexing operations</p>
        </div>
        <button type="button" className="adm-btn" onClick={load}>Refresh</button>
      </div>

      {error && <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>}
      {notice && <Alert kind="info" onDismiss={() => setNotice('')}>{notice}</Alert>}

      <div className="adm-card">
        <div className="adm-card-pad"><strong>Components</strong></div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr><th>Component</th><th>State</th><th>Reported</th><th>Detail</th></tr>
            </thead>
            <tbody>
              <Row label="AI service" value={ai.status || 'unreachable'} detail={ai.detail} />
              <Row label="Vector store (Qdrant)" value={ai.vector_store || 'unknown'} />
              <Row label="Embeddings" value={ai.embeddings || 'unknown'} />
              <Row label="LLM" value={ai.llm || 'unknown'} />
              {/* Whether the assistant's rate limiter, conversation memory and
                  metrics are shared across its workers. "in-process" means each
                  worker enforces its own limit — which is only safe on one. */}
              <Row
                label="Assistant shared state"
                value={ai.shared_state === 'redis' ? 'ok (redis)' : ai.shared_state || 'unknown'}
                detail={
                  ai.shared_state === 'redis'
                    ? 'Rate limits, conversation memory and metrics are shared across workers.'
                    : 'Per-process — run the assistant with a single worker, or set REDIS_URL.'
                }
              />
              <Row label="Database" value={status.database?.status} detail="PostgreSQL" />
              <Row label="Redis" value={status.redis?.status} detail={status.redis?.detail} />
              <Row label="Job queue" value={status.queue?.status} detail={status.queue?.detail} />
            </tbody>
          </table>
        </div>
      </div>

      {ai.providers?.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-pad">
            <strong>Generation providers</strong>
            <div className="adm-hint">
              Failover order. An open circuit means that provider is being skipped until it cools
              down.
            </div>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Provider</th><th>Circuit</th><th>Configured</th><th>Failures</th></tr>
              </thead>
              <tbody>
                {ai.providers.map((provider) => (
                  <tr key={provider.provider}>
                    <td className="adm-cell-title">{provider.provider}</td>
                    <td>
                      <StatusPill status={provider.state === 'closed' ? 'completed' : 'failed'} />
                    </td>
                    <td className="adm-cell-muted">{provider.configured ? 'yes' : 'no'}</td>
                    <td className="adm-cell-muted">{provider.failures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="adm-card">
        <div className="adm-card-pad">
          <strong>Chat performance</strong>
          <div className="adm-hint">
            {metrics.window ?? 0} recent turn(s) of a {metrics.window_limit ?? 0}-turn window.{' '}
            {metrics.scope}
          </div>
        </div>
        <div className="adm-card-pad">
          <div className="adm-stats">
            <Latency label="Total response" stats={latency.total} />
            <Latency label="Retrieval" stats={latency.retrieval} />
            <Latency label="Generation" stats={latency.llm} />
            <div className="adm-stat">
              <div className="adm-stat-label">Turns</div>
              <div className="adm-stat-value">{totals.turns ?? 0}</div>
            </div>
            <div className="adm-stat">
              <div className="adm-stat-label">Declined</div>
              <div className="adm-stat-value">{totals.no_context ?? 0}</div>
            </div>
            <div className="adm-stat">
              <div className="adm-stat-label">Degraded</div>
              <div className={`adm-stat-value${totals.degraded ? ' is-warn' : ''}`}>
                {totals.degraded ?? 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {metrics.recent_errors?.length > 0 && (
        <div className="adm-card">
          <div className="adm-card-pad"><strong>Recent errors</strong></div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Request</th><th>Mode</th><th>Provider</th><th>Error</th></tr>
              </thead>
              <tbody>
                {metrics.recent_errors.map((row, index) => (
                  <tr key={`${row.request_id}-${index}`}>
                    <td className="adm-cell-muted">{row.request_id}</td>
                    <td>{row.mode}</td>
                    <td className="adm-cell-muted">{row.provider || '—'}</td>
                    <td className="adm-cell-muted">{row.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="adm-card">
        <div className="adm-card-pad">
          <div className="adm-row">
            <div>
              <strong>Indexing</strong>
              <div className="adm-hint">
                {jobs?.active
                  ? `${jobs.active} job(s) running — this page is polling.`
                  : 'No jobs running.'}
              </div>
            </div>
            <span className="adm-spacer" />
            <button type="button" className="adm-btn" onClick={handleReindexAll} disabled={busy}>
              {busy ? 'Scheduling…' : 'Re-index all published'}
            </button>
          </div>
        </div>
        <div className="adm-table-wrap">
          {!jobs?.results?.length ? (
            <Empty>Nothing has been indexed yet.</Empty>
          ) : (
            <table className="adm-table">
              <thead>
                <tr><th>Document</th><th>Version</th><th>Status</th><th>Chunks</th><th>Error</th></tr>
              </thead>
              <tbody>
                {jobs.results.slice(0, 15).map((job) => (
                  <tr key={job.id}>
                    <td className="adm-cell-title">{job.document}</td>
                    <td className="adm-cell-muted">v{job.version}</td>
                    <td><StatusPill status={job.status} /></td>
                    <td>{job.chunks_indexed || '—'}</td>
                    <td className="adm-cell-muted" title={job.error || ''}>
                      {job.error ? `${job.error.slice(0, 50)}…` : '—'}
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
