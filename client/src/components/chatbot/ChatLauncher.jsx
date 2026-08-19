// The floating trigger.
//
// It carries a message mark, so what it opens is legible before it is clicked —
// but the control around it is still the site's own: a squared hairline border,
// letterspaced caps, no pill and no glow. The icon says "conversation"; the
// frame says which firm's site you are on.

import { forwardRef } from 'react';

// Drawn rather than imported, so it sits at the same weight as the rest of the
// icon set in components/ui/Icon.jsx. Sized in em, like all of them.
function MessageMark() {
  return (
    <svg className="chat-launcher__seal" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseMark() {
  return (
    <svg className="chat-launcher__seal" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="square" />
    </svg>
  );
}

const ChatLauncher = forwardRef(function ChatLauncher(
  { open, controls, onOpen, onClose, onPrefetch },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={`chat-launcher${open ? ' is-open' : ''}`}
      // The label states what it does, not what it is: "SLA Assistant" alone
      // leaves a screen-reader user to guess whether activating it opens
      // something or navigates away.
      aria-label={open ? 'Close the SLA Advocates assistant' : 'Open the SLA Advocates assistant'}
      aria-expanded={open}
      aria-controls={controls}
      onClick={open ? onClose : onOpen}
      // Both, because a keyboard visitor never fires a pointer event and would
      // otherwise be the only one waiting for the chunk.
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <span className="chat-launcher__mark">{open ? <CloseMark /> : <MessageMark />}</span>
      <span className="chat-launcher__label">Ask SLA</span>
    </button>
  );
});

export default ChatLauncher;
