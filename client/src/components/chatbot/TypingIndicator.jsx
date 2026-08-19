// The waiting state.
//
// Announced as text to assistive technology and drawn as three settling rules
// for everyone else — the three dots of a messaging app, restated in the site's
// own vocabulary. Under prefers-reduced-motion the CSS drops the animation and
// leaves the label, which is the part that actually carries the information.

export default function TypingIndicator() {
  return (
    <p className="chat-typing">
      {/* The live region is on the transcript itself, so this is marked as a
          status for anything that reads it directly and left silent otherwise —
          announcing both would say it twice. */}
      <span className="chat-typing__label">Composing a reply</span>
      <span className="chat-typing__marks" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </p>
  );
}
