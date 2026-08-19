// Admin sign-in.
//
// The form is the whole page rather than a modal over the dashboard: there is
// nothing behind it to see, and rendering the dashboard underneath would mean
// building it for a user who is not allowed to have it.
//
// No client-side password rules beyond "not empty". Django enforces the real
// validators, and a second, weaker copy here would eventually disagree with it.

import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Empty, Field } from '../components/Primitives.jsx';
import { useAdminAuth } from '../lib/useAdminAuth.jsx';

// Where an administrator lands when they signed in directly rather than being
// bounced here from somewhere else.
const DEFAULT_DESTINATION = '/admin';

export default function Login() {
  const { signIn, user, checking } = useAdminAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // RequireAuth stores the page it interrupted here, so signing in returns the
  // administrator to what they actually asked for rather than to the dashboard.
  //
  // Captured once, on the first render, and never recomputed. This is
  // load-bearing: the redirect below re-evaluates after the router has already
  // moved, and by then `location` is the *destination*, whose state is null —
  // reading it again would resolve to the default and bounce the administrator
  // to the dashboard they did not ask for.
  const destination = useRef(location.state?.from?.pathname || DEFAULT_DESTINATION).current;

  // Waiting on the session check before deciding, so an already-signed-in
  // administrator who lands here is not shown a form for a moment first.
  if (checking) return <Empty>Checking session…</Empty>;

  // Already signed in — nothing to do here. This is the *only* redirect: it
  // covers landing on /admin/login by hand and the moment after a successful
  // submit, so there is no imperative navigate() racing it. Two mechanisms
  // aiming at the same destination is how one of them ends up winning with a
  // stale value.
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      // No navigate() here. Setting the session re-renders this component, and
      // the `if (user)` redirect above does the move — with `replace`, so Back
      // does not return to the login form of a session that is now active.
    } catch (err) {
      // Deliberately does not distinguish "no such user" from "wrong password".
      // Django's own view returns one message for both, and echoing a finer
      // distinction here would turn the form into a way to enumerate accounts.
      setError(err?.status === 401 ? 'Incorrect username or password.' : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={handleSubmit}>
        <h1 className="adm-login-title">SLA Advocates</h1>
        <p className="adm-login-sub">Knowledge base administration</p>

        <Alert kind="error">{error}</Alert>

        <Field label="Username">
          <input
            className="adm-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </Field>

        <Field label="Password">
          <input
            className="adm-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        <button type="submit" className="adm-btn is-primary" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
