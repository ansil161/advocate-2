// The transcript, and the only element in the panel that scrolls.
//
// Auto-scroll follows one rule: the newest message is pinned to view *unless
// the visitor has scrolled up to read something*, in which case moving the view
// out from under them would be worse than letting the new reply arrive
// off-screen. The pinned state is measured before the browser paints, so the
// decision is made against where the transcript was, not where it has already
// jumped to.

import { useEffect, useLayoutEffect, useRef } from 'react';
import { consult } from '../../data/consult.js';
import ChatMessage from './ChatMessage.jsx';
import ChatWelcome from './ChatWelcome.jsx';
import SuggestedQuestions from './SuggestedQuestions.jsx';
import TypingIndicator from './TypingIndicator.jsx';

// How far from the bottom still counts as "following the conversation". A few
// lines of slack, so a fractional scroll position or a rounding difference
// between browsers does not read as a deliberate scroll away.
const PIN_TOLERANCE_PX = 64;

export default function ChatMessages({
  greeting,
  messages,
  suggestions,
  isSending,
  error,
  onRetry,
  onDismissError,
  onAsk,
  open,
}) {
  const scrollerRef = useRef(null);
  const pinned = useRef(true);

  // Updated only when the visitor actually scrolls — never on render.
  //
  // Measuring this in a layout effect looks equivalent and is not: by the time
  // one runs, React has already inserted the new message, so scrollHeight
  // includes content the visitor has not seen and the transcript always
  // measures as "scrolled away". The result is auto-scroll that silently never
  // fires. A scroll listener is the only thing that knows why the position
  // changed.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return undefined;
    const onScroll = () => {
      pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight <= PIN_TOLERANCE_PX;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => node.removeEventListener('scroll', onScroll);
  }, []);

  const empty = messages.length === 0;

  // Both scroll effects are held off while the panel is still on its welcome
  // state. There is nothing to follow yet, and on a short viewport the greeting
  // is tall enough to overflow — pinning that to the bottom opens the panel
  // with its mark and heading scrolled off the top, which is the one view the
  // empty state exists to show.
  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node || empty || !pinned.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, isSending, error, suggestions, empty]);

  // A panel reopened after a conversation should show the end of it, not
  // wherever it happened to be scrolled when it was dismissed.
  useEffect(() => {
    const node = scrollerRef.current;
    if (!open || !node) return;
    node.scrollTop = empty ? 0 : node.scrollHeight;
  }, [open, empty]);

  return (
    <div
      // Empty, the panel centres its greeting the way the reference layout
      // does; the moment there is a transcript, content starts at the top and
      // grows downward.
      className={`chat-scroll${empty ? ' is-empty' : ''}`}
      ref={scrollerRef}
      // Belt and braces with the panel-level attribute: this is the element the
      // wheel actually lands on, and Lenis checks the event target's ancestors.
      data-lenis-prevent
      tabIndex={0}
      role="log"
      // polite, not assertive: a reply is worth announcing, and worth waiting
      // for a natural pause to announce.
      aria-live="polite"
      aria-relevant="additions"
      aria-label="Conversation"
    >
      {empty ? (
        <ChatWelcome greeting={greeting} phone={consult.phone} phoneHref={consult.phoneHref} />
      ) : null}

      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}

      {isSending && <TypingIndicator />}

      {error && (
        <div className="chat-error" role="alert">
          <p>{error.text}</p>
          <div className="chat-error__actions">
            {error.retryable && (
              <button type="button" className="chat-error__retry" onClick={onRetry}>
                <span>Try again</span>
              </button>
            )}
            <button type="button" className="chat-error__dismiss" onClick={onDismissError}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Hidden while a reply is in flight: offering a new question mid-answer
          invites a click that would cancel the one already running. */}
      {!isSending && (
        <SuggestedQuestions
          questions={suggestions}
          onAsk={onAsk}
          disabled={isSending}
          label={empty ? 'Try asking' : 'You might also ask'}
          variant={empty ? 'hero' : 'inline'}
        />
      )}
    </div>
  );
}
