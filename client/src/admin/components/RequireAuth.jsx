// Route guard for the admin panel.
//
// This is a *usability* control, not a security one, and the distinction is
// worth stating because it is easy to mistake. It stops an administrator seeing
// a dashboard whose every request would fail with a 401. It stops nothing else:
// the browser is the attacker's machine, and anyone can render this component's
// children by editing the bundle. Every endpoint behind it is independently
// guarded server-side by `@admin_required`, and that is the check that counts.
//
// The redirect carries the location it interrupted, so signing in returns the
// administrator to the page they actually asked for. Someone who follows a link
// to a specific document and is asked to log in should land on that document,
// not on a dashboard that makes them navigate again.

import { Navigate, useLocation } from 'react-router-dom';
import { Empty } from './Primitives.jsx';
import { useAdminAuth } from '../lib/useAdminAuth.jsx';

export default function RequireAuth({ children }) {
  const { user, checking } = useAdminAuth();
  const location = useLocation();

  // "Not asked yet" must not render as "logged out", or the login form flashes
  // on every reload for an administrator who is already signed in — and worse,
  // the redirect below would overwrite the location they were restoring to.
  if (checking) return <Empty>Checking session…</Empty>;

  if (!user) {
    return (
      // `replace` so the guarded URL does not stay in history: pressing Back
      // after signing in should not return to a page that bounced them out.
      <Navigate to="/admin/login" replace state={{ from: location }} />
    );
  }

  return children;
}
