// The panel's top row: two ghost icon buttons, right-aligned, exactly as the
// reference design draws them.
//
// The reference's marks are decorative — it is a static card. Both are wired to
// real actions here, because a control that looks like a button and does
// nothing is worse than no control: the grid mark starts a fresh conversation,
// the cross closes the panel.

export default function ChatHeader({ onClose, onReset, canReset }) {
  return (
    <header className="chat-head">
      <button
        type="button"
        className="chat-head__btn"
        onClick={onClose}
        aria-label="Close the assistant"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M18 6l-12 12" />
          <path d="M6 6l12 12" />
        </svg>
      </button>
    </header>
  );
}
