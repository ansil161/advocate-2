// The chip row — the reference design's Badge set: h-7, rounded-md, secondary
// ground, a 3.5 icon in its own hue, xs label.
//
// The reference's chips are two-word actions ("Create image", "Analyze data").
// The questions this assistant offers are full sentences, written that way
// because the service sends the exact string that gets asked. Rendered raw they
// would each wrap onto their own row and the compact wrapped set the design is
// built around would be lost — so each known question is given a short chip
// label here, while the full sentence is what gets sent and what assistive
// technology announces. A question this map does not know still works: it falls
// back to its own text.

// Keyed to the phrasings in ai_service/app/services/suggestions.py. If a
// suggestion is reworded there and not here, the chip widens rather than
// breaks — which is why this is a display concern and not a routing one.
const CHIP_LABELS = {
  'what areas of law does sla advocates handle?': 'Practice areas',
  'who founded the firm?': 'The founder',
  "tell me about the firm's experience.": 'Experience',
  'how can i contact the firm?': 'Contact',
  'which courts and tribunals does the firm appear before?': 'Courts',
  'what happens after i make contact?': 'Next steps',
  "who else is on the firm's bench?": 'The bench',
  "where is the firm's office?": 'The office',
};

// The service also composes "What does the firm do in {practice area}?" from
// the indexed corpus, so those cannot be listed one by one.
const PRACTICE_AREA = /^what does the firm do in (.+)\?$/i;

function chipLabel(question) {
  const known = CHIP_LABELS[question.trim().toLowerCase()];
  if (known) return known;
  const area = question.trim().match(PRACTICE_AREA);
  if (area) return area[1];
  return question;
}

// The reference's six marks and their hues, in its own order, redrawn for what
// this assistant is actually asked about. Cycled by position: the service
// decides which questions to offer and how many, so a mark cannot be tied to a
// particular question — it is there to give each chip a fixed leading shape.
const MARKS = [
  { tone: 'blue', d: 'M5 4.75h14v14.5H5zM8 9h8M8 12.5h8M8 16h4.5' },
  { tone: 'orange', d: 'M12 11.5a3 3 0 100-6 3 3 0 000 6zM5.5 19.25c0-3.2 2.9-5.25 6.5-5.25s6.5 2.05 6.5 5.25' },
  { tone: 'green', d: 'M12 4.5v15M6.5 19.5h11M4 8.5h16M4 8.5l-2 5h4zM20 8.5l2 5h-4z' },
  { tone: 'pink', d: 'M4 5.5h16v13H4zM4 6l8 6 8-6' },
  { tone: 'yellow', d: 'M12 21c4-4.6 6-8.05 6-10.35A6 6 0 006 10.65C6 12.95 8 16.4 12 21zM12 12.4a2 2 0 100-4 2 2 0 000 4z' },
  { tone: 'purple', d: 'M12 20a8 8 0 10-6.9-3.95L4 20l4.1-1.05A7.96 7.96 0 0012 20z' },
];

function ChipMark({ index }) {
  const mark = MARKS[index % MARKS.length];
  return (
    <svg
      className={`chat-suggest__glyph chat-suggest__glyph--${mark.tone}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={mark.d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function SuggestedQuestions({
  questions,
  onAsk,
  disabled,
  label = 'Try asking',
  // The empty state centres its row under the greeting and drops the label,
  // as the reference does; the follow-up row after a reply keeps both.
  variant = 'inline',
}) {
  if (!questions?.length) return null;

  return (
    <nav className={`chat-suggest chat-suggest--${variant}`} aria-label={label}>
      <span className="chat-suggest__label">{label}</span>
      <ul className="chat-suggest__list">
        {questions.map((question, index) => {
          const short = chipLabel(question);
          return (
            <li key={question}>
              <button
                type="button"
                className="chat-suggest__chip"
                onClick={() => onAsk(question)}
                disabled={disabled}
                // The chip may be showing two words; the accessible name is
                // always the question that will actually be sent.
                aria-label={short === question ? undefined : question}
                title={short === question ? undefined : question}
              >
                <ChipMark index={index} />
                {short}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
