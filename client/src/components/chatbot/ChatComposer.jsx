// The composer, built to the reference design: a ring-framed textarea over a
// bar carrying the keyboard rules and the send control.
//
// The reference's leading search mark, its microphone, its model select and
// its attach and shortcuts buttons are all deliberately absent — every one of
// them was a control with nothing behind it in this deployment.
//
// A textarea rather than an input, because Shift+Enter has to be able to add a
// line — and because a question about a property matter is often longer than
// one line. It sits at the reference's 100px and grows from there to a ceiling,
// after which it scrolls, so the transcript above never collapses to nothing.

import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { MAX_MESSAGE_CHARS } from '../../lib/useChat.js';

// The reference's min-h-[100px] is the floor, and it lives in the stylesheet
// so short viewports can lower it. Past this ceiling the field scrolls instead
// of growing, so the conversation stays readable while a long question is
// being written.
const MAX_FIELD_HEIGHT = 168;

// Only shown once the visitor is close enough to the limit for it to be useful.
// A counter that is visible from the first keystroke reads as a constraint on
// what they are allowed to ask.
const COUNTER_VISIBLE_FROM = MAX_MESSAGE_CHARS - 150;

const ChatComposer = forwardRef(function ChatComposer({ disabled, onSend }, ref) {
  const [value, setValue] = useState('');
  const fallbackRef = useRef(null);
  const field = ref || fallbackRef;

  // Height is measured and applied before paint, so the field never renders one
  // frame at the wrong size — the same measured-height technique the team
  // page's profile cards use.
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    const needed = node.scrollHeight;
    // The floor is the stylesheet's min-height, not a number here — CSS
    // min-height always beats an inline height, so the field cannot be sized
    // below it, and the short-viewport media queries can lower it without this
    // effect fighting them back to 100px.
    node.style.height = `${Math.min(needed, MAX_FIELD_HEIGHT)}px`;
    // Overflow is driven explicitly rather than left at `auto`. scrollHeight
    // excludes the border, so a field sized to exactly its content is a hair
    // too short for it and the browser paints a scrollbar down an otherwise
    // clean composer. It should appear only once the field has genuinely
    // stopped growing.
    node.style.overflowY = needed > MAX_FIELD_HEIGHT ? 'auto' : 'hidden';
  }, [value, field]);

  const trimmed = value.trim();
  const canSend = Boolean(trimmed) && !disabled;

  function submit(event) {
    event?.preventDefault();
    if (!canSend) return;
    onSend(trimmed);
    setValue('');
  }

  function onKeyDown(event) {
    // Enter sends, Shift+Enter breaks the line. `isComposing` is checked
    // because an IME uses Enter to accept a candidate — sending there would
    // fire mid-word for anyone typing a language that needs one.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      submit(event);
    }
  }

  return (
    <form className="chat-composer" onSubmit={submit}>
      <label className="chat-composer__label" htmlFor="chat-composer-field">
        Ask about the firm
      </label>

      <div className="chat-composer__row">
        <textarea
          id="chat-composer-field"
          ref={field}
          className="chat-composer__field"
          rows={1}
          value={value}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder="Ask me anything..."
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <div className="chat-composer__actions">
          {value.length >= COUNTER_VISIBLE_FROM && (
            <span className="chat-composer__count">
              {value.length} / {MAX_MESSAGE_CHARS}
            </span>
          )}

          <button
            type="submit"
            className="chat-composer__send"
            disabled={!canSend}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 12h15M13 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
});

export default ChatComposer;
