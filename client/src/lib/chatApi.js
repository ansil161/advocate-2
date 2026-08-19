// The only place the site talks to the AI service.
//
// This is a new API layer because the site did not have one — the consultation
// form hands its enquiry to the visitor's mail client rather than posting it
// anywhere (see components/ui/ContactForm.jsx). If a real enquiry endpoint is
// ever added, `request` below is the piece to reuse rather than to copy.
//
// Everything here fails in a way the interface can act on: each rejection is a
// ChatApiError carrying a `kind`, so useChat can decide between "offer a retry"
// and "tell them to wait" without parsing a message string.

import { consult } from '../data/consult.js';

// Falls back to a same-origin path so a deployment that reverse-proxies the AI
// service under /api needs no build-time configuration at all.
const BASE = (import.meta.env.VITE_AI_API_URL || '').replace(/\/$/, '');

// Comfortably longer than the service's own 30s LLM timeout, so a slow answer
// arrives rather than being abandoned one second before it lands. The service
// is the component that should be deciding a request has taken too long.
const TIMEOUT_MS = 40000;

export class ChatApiError extends Error {
  // kind: 'network' | 'timeout' | 'rate_limited' | 'server' | 'invalid'
  constructor(kind, message, { retryAfter = 0 } = {}) {
    super(message);
    this.name = 'ChatApiError';
    this.kind = kind;
    this.retryAfter = retryAfter;
  }

  // Whether offering a retry button would be honest. A rate limit clears on its
  // own and a rejected message will be rejected identically next time; neither
  // is worth inviting someone to try again immediately.
  get retryable() {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server';
  }
}

// The one place a visitor-facing failure sentence is written on this side.
// Deliberately mirrors the tone of the service's own fallbacks, and names the
// firm's real contact details — which live in data/consult.js, so there is no
// second copy of the phone number anywhere in the chatbot.
export const ERROR_TEXT = {
  network: `I couldn't reach the firm's assistant just now. Please check your connection and try again, or call ${consult.phone}.`,
  timeout: `That took longer than expected. Please try again, or call ${consult.phone}.`,
  rate_limited:
    'You have sent several messages in quick succession. Please wait a moment before sending another.',
  server: `I'm temporarily unable to respond. Please try again shortly, or contact the firm directly on ${consult.phone}.`,
  invalid: 'That message could not be sent. Please try rephrasing it.',
};

async function request(path, { method = 'GET', body, signal } = {}) {
  // Two things can cancel this: the caller's own signal (the panel closing, the
  // component unmounting) and the timeout. AbortSignal.any joins them so
  // whichever fires first wins and neither leaks a pending timer.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const signals = signal ? [signal, timeout.signal] : [timeout.signal];

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any(signals),
    });
  } catch (error) {
    // A caller-initiated abort is not a failure to report — the panel closed,
    // or the component went away. Rethrown so the hook can ignore it.
    if (signal?.aborted) throw error;
    if (timeout.signal.aborted) throw new ChatApiError('timeout', ERROR_TEXT.timeout);
    throw new ChatApiError('network', ERROR_TEXT.network);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 60;
    throw new ChatApiError('rate_limited', ERROR_TEXT.rate_limited, { retryAfter });
  }
  if (response.status === 422 || response.status === 413) {
    throw new ChatApiError('invalid', ERROR_TEXT.invalid);
  }
  if (!response.ok) {
    throw new ChatApiError('server', ERROR_TEXT.server);
  }

  try {
    return await response.json();
  } catch {
    // A 200 that is not JSON almost always means something in between — a
    // captive portal, a proxy error page — answered instead of the service.
    throw new ChatApiError('server', ERROR_TEXT.server);
  }
}

// The panel's initial state: the greeting and the opening questions. Served by
// the AI service so the firm's opening line can change without a site deploy.
export function fetchOpening({ signal } = {}) {
  return request('/api/chat/opening', { signal });
}

export function sendMessage({ message, conversationId, signal }) {
  return request('/api/chat', {
    method: 'POST',
    // conversation_id is omitted rather than sent as null on the first turn —
    // the service mints one and returns it.
    body: conversationId ? { message, conversation_id: conversationId } : { message },
    signal,
  });
}
