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

import SlaLogo from '../../components/ui/SlaLogo.jsx';

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

  const destination = useRef(location.state?.from?.pathname || DEFAULT_DESTINATION).current;

  if (checking) return <Empty>Checking session…</Empty>;
  if (user) return <Navigate to={destination} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(err?.status === 401 ? 'Incorrect username or password.' : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={handleSubmit}>
        <div className="adm-login-logo">
          <SlaLogo size="lg" />
        </div>
        <h1 className="adm-login-title">Admin Console</h1>
        <p className="adm-login-sub">Knowledge Base & AI Operations Portal</p>


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
