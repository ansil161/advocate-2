// Small shared pieces for the admin panel.
//
// Grouped in one file rather than split one-per-file: each is a handful of
// lines with no state, and eight modules that each export a `<span>` is
// filing, not architecture. The screens themselves are separate components
// (§54) — that is where the size actually lives.

import { useEffect, useRef, useState } from 'react';

// Status vocabulary is shared with the backend: document status
// (draft/published/archived) and job status (queued/processing/completed/
// failed) both render through this, so a state cannot appear styled in one
// place and unstyled in another.
export function StatusPill({ status }) {
  if (!status) return null;
  return (
    <span className={`adm-pill is-${status}`}>
      <i className="adm-pill-dot" aria-hidden="true" />
      {status}
    </span>
  );
}

export function Alert({ kind = 'info', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`adm-alert is-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="adm-row">
        <span>{children}</span>
        {onDismiss && (
          <>
            <span className="adm-spacer" />
            <button type="button" className="adm-btn is-small" onClick={onDismiss}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="adm-field">
      <span className="adm-label">{label}</span>
      {children}
      {hint && <span className="adm-hint">{hint}</span>}
    </label>
  );
}

export function Empty({ children }) {
  return <div className="adm-empty">{children}</div>;
}

/**
 * A destructive action that needs a second press to fire.
 *
 * Deliberately not `window.confirm`: a native dialog blocks the whole page and,
 * in an embedded/automated context, blocks it indefinitely. This is also
 * gentler — the button becomes "Really delete?" for a few seconds and then
 * gives up, so an accidental first click costs nothing and expires on its own.
 */
export function ConfirmButton({ children, confirmLabel = 'Confirm?', onConfirm, className = '', disabled }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handle() {
    if (armed) {
      clearTimeout(timer.current);
      setArmed(false);
      onConfirm();
      return;
    }
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), 4000);
  }

  return (
    <button type="button" className={className} onClick={handle} disabled={disabled}>
      {armed ? confirmLabel : children}
    </button>
  );
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
