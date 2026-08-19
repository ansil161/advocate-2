// The conversation panel. Lazy-loaded — nothing in this file, or anything it
// imports, is in the main bundle.
//
// Two things in here exist specifically to leave the rest of the site alone.
//
// **Scroll.** Lenis owns the page's scroll position globally (lib/useLenis.js),
// so a scrollable element inside a fixed panel would otherwise scroll the page
// underneath instead of itself. `data-lenis-prevent` is Lenis's own opt-out and
// is the entire fix on desktop — no configuration is changed, no listener is
// added, and the page behind keeps behaving exactly as it did. Only the mobile
// layout, where the panel covers the viewport, additionally pauses Lenis, and
// it always restarts it on the way out.
//
// **Focus.** The panel traps focus only when it is genuinely modal, which is
// the compact layout. On desktop it is a drawer beside a page the visitor can
// still read and use, and trapping focus in a non-modal surface strands anyone
// navigating by keyboard.

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { getLenis } from '../../lib/useLenis.js';
import { useChat } from '../../lib/useChat.js';
import ChatHeader from './ChatHeader.jsx';
import ChatMessages from './ChatMessages.jsx';
import ChatComposer from './ChatComposer.jsx';
// Imported here rather than by the widget so it is emitted into this lazy
// chunk — a visitor who never opens the assistant never downloads it.
import './Chatbot.css';

// Matches the `max-width: 720px` rule in Chatbot.css, which is the site's
// dominant mobile breakpoint. Kept in sync by hand — there is no way to read a
// media query out of a stylesheet, and duplicating it in JS is the lesser evil
// against guessing at a different number.
const COMPACT_QUERY = '(max-width: 720px)';

// The site's own easing token, so the panel arrives with the same motion
// character as everything else on the page.
const EASE = [0.16, 1, 0.3, 1];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Subscribed rather than read once: a tablet rotating from landscape to
// portrait crosses this boundary, and the panel has to change from a drawer to
// a full-screen surface — including whether it locks scroll and traps focus.
function useCompactLayout() {
  const subscribe = useCallback((notify) => {
    const query = window.matchMedia(COMPACT_QUERY);
    query.addEventListener('change', notify);
    return () => query.removeEventListener('change', notify);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false
  );
}

export default function ChatPanel({ open, titleId, onClose }) {
  const chat = useChat();
  const compact = useCompactLayout();
  const reduceMotion = useReducedMotion();

  const panelRef = useRef(null);
  const composerRef = useRef(null);

  // ── Escape closes, from anywhere inside the panel ────────────────────────
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    const node = panelRef.current;
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // ── Focus into the panel on open ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // preventScroll throughout: Lenis owns the page position and focusing an
    // element must never move it.
    composerRef.current?.focus({ preventScroll: true });
  }, [open]);

  // ── Focus trap, only while the panel is modal ────────────────────────────
  useEffect(() => {
    if (!open || !compact) return undefined;
    function onKeyDown(event) {
      if (event.key !== 'Tab') return;
      const targets = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!targets?.length) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    const node = panelRef.current;
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [open, compact]);

  // ── Pause Lenis, but only for the full-screen layout ─────────────────────
  useEffect(() => {
    // Nothing to do on desktop: the page behind stays scrollable on purpose,
    // and data-lenis-prevent already keeps the wheel inside the message list.
    if (!open || !compact) return undefined;

    const lenis = getLenis();
    // Null under prefers-reduced-motion, where Lenis is never constructed at
    // all — the page is on native scrolling and needs no intervention.
    if (!lenis) return undefined;

    lenis.stop();
    // Restarted on every exit from this effect, including a close, an unmount,
    // and a rotation back to the desktop layout. This is the line that decides
    // whether the site still scrolls after the panel is dismissed.
    return () => lenis.start();
  }, [open, compact]);

  const showError = chat.status === 'error' && chat.error;

  return (
    <motion.section
      ref={panelRef}
      id={titleId}
      className={`chat-panel${open ? ' is-open' : ''}`}
      // A dialog either way, but only modal when it covers the screen — which
      // is what tells a screen reader whether the page behind is still
      // available to explore.
      role="dialog"
      aria-modal={compact ? 'true' : 'false'}
      aria-label="SLA Advocates assistant"
      // Removes the whole subtree from the tab order and the accessibility tree
      // while hidden, so a closed panel cannot be tabbed into. Same mechanism
      // the consultation form uses for its resolved state.
      inert={!open}
      // Lenis's own opt-out. Without it, a wheel gesture over the transcript
      // scrolls the page behind instead of the conversation.
      data-lenis-prevent
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={
        reduceMotion
          ? {
              // No travel and no fade for a visitor who has asked for neither.
              // The panel still has to disappear, so visibility does the work
              // that opacity does otherwise.
              open: { opacity: 1, y: 0, visibility: 'visible' },
              closed: { opacity: 0, y: 0, transitionEnd: { visibility: 'hidden' } },
            }
          : {
              open: {
                opacity: 1,
                y: 0,
                visibility: 'visible',
                transition: { duration: 0.42, ease: EASE },
              },
              closed: {
                opacity: 0,
                y: 14,
                transition: { duration: 0.26, ease: EASE },
                transitionEnd: { visibility: 'hidden' },
              },
            }
      }
    >
      <ChatHeader
        onClose={onClose}
        onReset={chat.reset}
        // Nothing to clear on an untouched panel, so the control says so
        // rather than sitting there as a no-op.
        canReset={chat.messages.length > 0}
      />

      {/* The reference's CardContent: the transcript takes the space and the
          composer is pushed to the bottom of it. */}
      <div className="chat-body">
        <ChatMessages
          greeting={chat.greeting}
          messages={chat.messages}
          suggestions={chat.suggestions}
          isSending={chat.isSending}
          error={showError ? chat.error : null}
          onRetry={chat.retry}
          onDismissError={chat.dismissError}
          onAsk={chat.send}
          open={open}
        />

        <ChatComposer
          ref={composerRef}
          disabled={chat.isSending}
          onSend={(text) => {
            if (showError) chat.dismissError();
            chat.send(text);
          }}
        />
      </div>
    </motion.section>
  );
}
