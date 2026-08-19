// The admin panel's only route to the Django backend.
//
// Separate from lib/chatApi.js on purpose: that one talks to the AI service,
// is unauthenticated, and is loaded by every visitor. This one carries a
// session cookie and a CSRF token and must never end up in the public bundle —
// which is why it lives under src/admin/, reached only through the lazy import
// in App.jsx.
//
// Session cookies rather than a token in localStorage. The session cookie is
// HttpOnly, so a script injected into this page cannot read it; a JWT in
// localStorage is readable by any script that gets a foothold, and "the admin
// panel that edits the knowledge base" is not where to accept that trade.

const BASE = (import.meta.env.VITE_ADMIN_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// Django's default cookie name. Read rather than stored: the server rotates it
// on login, and a copy kept in memory goes stale exactly when it matters.
const CSRF_COOKIE = 'csrftoken';

export class AdminApiError extends Error {
  // kind: 'network' | 'auth' | 'forbidden' | 'conflict' | 'validation' | 'upstream' | 'server'
  constructor(kind, message, { status = 0 } = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.status = status;
  }

  // Whether the failure is the user's session rather than their input — the
  // panel redirects to login for these instead of showing an inline error.
  get isAuth() {
    return this.kind === 'auth';
  }
}

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

// Django only sets the CSRF cookie once something asks for it. Calling this
// before the first unsafe request is what makes login work on a cold browser.
export async function primeCsrf() {
  try {
    await fetch(`${BASE}/api/csrf/`, { credentials: 'include' });
  } catch {
    // Non-fatal: the request that needs it will fail with a clearer message.
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const unsafe = method !== 'GET' && method !== 'HEAD';
  if (unsafe && !readCookie(CSRF_COOKIE)) await primeCsrf();

  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (unsafe) headers['X-CSRFToken'] = readCookie(CSRF_COOKIE);

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      // Sends the session cookie cross-origin. Requires the backend to name
      // this exact origin in CORS/CSRF_TRUSTED_ORIGINS — a wildcard is not
      // permitted with credentials, which is the correct constraint here.
      credentials: 'include',
      body: body === undefined ? undefined : (body instanceof FormData ? body : JSON.stringify(body)),
    });
  } catch {
    throw new AdminApiError('network', 'Could not reach the server. Check that it is running.');
  }

  if (response.status === 401) throw new AdminApiError('auth', 'Your session has expired.', { status: 401 });
  if (response.status === 403) {
    throw new AdminApiError('forbidden', 'You do not have administrator access.', { status: 403 });
  }

  let payload = null;
  try {
    payload = response.status === 204 ? null : await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // The server's own message is preferred: this is a staff-only surface, so
    // "another indexing job is already running" is exactly what should be shown
    // rather than being flattened into "something went wrong".
    const message = payload?.error || `Request failed (${response.status}).`;
    const kind =
      response.status === 409 ? 'conflict'
      : response.status === 422 ? 'validation'
      : response.status === 502 ? 'upstream'
      : 'server';
    throw new AdminApiError(kind, message, { status: response.status });
  }

  return payload;
}

// ── auth ─────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  await primeCsrf();
  return request('/api/login/', { method: 'POST', body: { username, password } });
}

export function logout() {
  return request('/api/logout/', { method: 'POST' });
}

export function currentUser() {
  return request('/api/user/');
}

// ── knowledge base ───────────────────────────────────────────────────────────

export function fetchDashboard() {
  return request('/api/admin/dashboard/');
}

export function listDocuments({
  status = '',
  category = '',
  indexStatus = '',
  updatedSince = '',
  q = '',
  page = 1,
} = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (category) params.set('category', category);
  if (indexStatus) params.set('index_status', indexStatus);
  if (updatedSince) params.set('updated_since', updatedSince);
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return request(`/api/admin/knowledge/${query ? `?${query}` : ''}`);
}

export function getDocument(id) {
  return request(`/api/admin/knowledge/${id}/`);
}

export function createDocument(data) {
  return request('/api/admin/knowledge/', { method: 'POST', body: data });
}

export function updateDocument(id, data) {
  return request(`/api/admin/knowledge/${id}/`, { method: 'PATCH', body: data });
}

export function deleteDocument(id) {
  return request(`/api/admin/knowledge/${id}/`, { method: 'DELETE' });
}

// publish | unpublish | archive | reindex. One function rather than four,
// because the server treats them as one endpoint and the UI treats them as one
// kind of thing: an action that can fail upstream and must be reported.
export function documentAction(id, action) {
  return request(`/api/admin/knowledge/${id}/${action}/`, { method: 'POST' });
}

export function listVersions(id) {
  return request(`/api/admin/knowledge/${id}/versions/`);
}

export function extractText(file) {
  const data = new FormData();
  data.append('file', file);
  return request('/api/admin/knowledge/extract/', { method: 'POST', body: data });
}

export function fetchChunks(id) {
  return request(`/api/admin/knowledge/${id}/chunks/`);
}

// ── operations ───────────────────────────────────────────────────────────────

export function reindexAll() {
  return request('/api/admin/knowledge/reindex-all/', { method: 'POST' });
}

export function listJobs(status = '') {
  return request(`/api/admin/jobs/${status ? `?status=${encodeURIComponent(status)}` : ''}`);
}

export function fetchSystemStatus() {
  return request('/api/admin/system/');
}

// ── diagnostics ──────────────────────────────────────────────────────────────
//
// Both proxy the AI service through Django. The browser never holds the
// internal shared secret, and one authentication system governs the whole
// admin surface.

// POST rather than GET even though it reads nothing: the question travels in
// the body so it stays out of access logs and proxy caches. Admins paste real
// visitor questions in here.
export function debugRetrieval(question, history = []) {
  return request('/api/admin/retrieval/', { method: 'POST', body: { question, history } });
}

export function fetchEvaluationCases() {
  return request('/api/admin/evaluation/');
}

// mode: 'retrieval' (default, free) | 'full' (one model call per case)
export function runEvaluation(mode = 'retrieval', category = '') {
  return request('/api/admin/evaluation/', { method: 'POST', body: { mode, category } });
}
