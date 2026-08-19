// One turn in the transcript.
//
// No bubbles. A visitor's question is set as a ruled aside against the panel's
// own ground; the assistant's reply is plain editorial text under a small gold
// label. The difference between the two speakers is carried by alignment,
// weight and a hairline — the same vocabulary the rest of the site uses — which
// is what keeps this from looking like a messaging app dropped into a law
// firm's website.
//
// The answer is rendered as text nodes, never as HTML. The model's output is
// untrusted by construction, and `dangerouslySetInnerHTML` anywhere near it
// would turn a prompt-injection foothold into stored XSS. Paragraph breaks are
// the only formatting honoured, and they are produced by splitting on blank
// lines rather than by parsing anything.

import { Link } from 'react-router-dom';

function Paragraphs({ text }) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => <p key={index}>{block}</p>);
}

export default function ChatMessage({ message }) {
  if (message.role === 'user') {
    return (
      <article className="chat-msg chat-msg--visitor">
        <h3 className="chat-msg__who">You</h3>
        <div className="chat-msg__body">
          <Paragraphs text={message.text} />
        </div>
      </article>
    );
  }

  const sources = message.sources || [];

  return (
    <article className="chat-msg chat-msg--assistant">
      <h3 className="chat-msg__who chat-msg__who--sla">SLA Assistant</h3>
      <div className="chat-msg__body">
        <Paragraphs text={message.text} />
      </div>
    </article>
  );
}
