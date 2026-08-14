// One line-art icon set for the whole site, drawn on a 24×24 grid in a single
// weight so a practice-area mark, a chapter mark and a process mark all read as
// members of the same family. Everything is stroked in `currentColor` and sized
// in `em`, so an icon inherits the colour and scale of the label it sits beside
// — the same way the numerals it replaced used to.
//
// Deliberately no gavel and no courthouse-with-gavel cliché; where a legal
// instrument is the clearest possible symbol (a balance for civil litigation, a
// colonnade for constitutional practice) it is drawn as thin architecture, not
// as an emblem.

const PATHS = {
  // ── practice areas ────────────────────────────────────────────────
  balance: (
    <>
      <path d="M12 3.6v16.4" />
      <path d="M8 20h8" />
      <path d="M4.6 7.4h14.8" />
      <path d="M4.6 7.4 2.2 13a2.4 2.4 0 0 0 4.8 0Z" />
      <path d="M19.4 7.4 17 13a2.4 2.4 0 0 0 4.8 0Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.2 4.6 6v6.1c0 4.2 3 7.3 7.4 8.7 4.4-1.4 7.4-4.5 7.4-8.7V6Z" />
      <path d="M9.3 12.1 11.3 14l3.6-3.7" />
    </>
  ),
  colonnade: (
    <>
      <path d="M3 4.8h18" />
      <path d="M6.6 4.8v12.4M12 4.8v12.4M17.4 4.8v12.4" />
      <path d="M4.4 17.2h15.2" />
      <path d="M3 20.4h18" />
    </>
  ),
  tower: (
    <>
      <path d="M4.6 20.6V9h6.6" />
      <path d="M11.2 20.6V4.4h8.2v16.2" />
      <path d="M2.8 20.6h18.4" />
      <path d="M7 12.2h1.8M7 15.8h1.8M14 7.6h2.6M14 11.4h2.6M14 15.2h2.6" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.4" rx="7" ry="2.9" />
      <path d="M5 6.4v5c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-5" />
      <path d="M5 11.4v5c0 1.6 3.1 2.9 7 2.9s7-1.3 7-2.9v-5" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6.4 3.2h11.2M6.4 20.8h11.2" />
      <path d="M7.6 3.2v3.1c0 2 4.4 3.8 4.4 5.7 0-1.9 4.4-3.7 4.4-5.7V3.2" />
      <path d="M7.6 20.8v-3.1c0-2 4.4-3.8 4.4-5.7 0 1.9 4.4 3.7 4.4 5.7v3.1" />
    </>
  ),
  ledger: (
    <>
      <path d="M6 2.8h8.4L18 6.4v14.8l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" />
      <path d="M14.4 2.8v3.6H18" />
      <path d="M8.8 9.6h5.6M8.8 13.2h5.6" />
    </>
  ),
  people: (
    <>
      <circle cx="9.2" cy="8.2" r="3.1" />
      <path d="M3.4 19.8c0-3.1 2.6-5.2 5.8-5.2s5.8 2.1 5.8 5.2" />
      <circle cx="17.2" cy="9.6" r="2.3" />
      <path d="M15.6 14.8c2.9.2 5 1.9 5 4.4" />
    </>
  ),
  mark_ip: (
    <>
      <path d="M9.4 17.6h5.2M10.4 20.4h3.2" />
      <path d="M12 3.4a5.5 5.5 0 0 0-3.2 9.9c.6.5 1 1.1 1.1 1.9h4.2c.1-.8.5-1.4 1.1-1.9A5.5 5.5 0 0 0 12 3.4Z" />
    </>
  ),
  house: (
    <>
      <path d="M3.2 10.6 12 3.4l8.8 7.2" />
      <path d="M5.4 9.2v11.4h13.2V9.2" />
      <path d="M9.8 20.6v-6.2h4.4v6.2" />
    </>
  ),
  rings: (
    <>
      <circle cx="9.2" cy="13.4" r="5.4" />
      <circle cx="15" cy="10.2" r="4.9" />
    </>
  ),
  tag: (
    <>
      <path d="M3.4 3.4h7.3a2 2 0 0 1 1.4.6l8 8a1.5 1.5 0 0 1 0 2.1l-5.2 5.2a1.5 1.5 0 0 1-2.1 0l-8-8a2 2 0 0 1-.6-1.4Z" />
      <circle cx="7.6" cy="7.6" r="1.3" />
    </>
  ),

  // ── industries ────────────────────────────────────────────────────
  care: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  mortarboard: (
    <>
      <path d="M2.4 9 12 4.4 21.6 9 12 13.6Z" />
      <path d="M6.6 11.1v4.7c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.7" />
      <path d="M21.6 9v5.2" />
    </>
  ),
  works: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.6v2.8M12 18.6v2.8M2.6 12h2.8M18.6 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2" />
    </>
  ),
  blocks: (
    <>
      <path d="M2.8 20.6h18.4" />
      <path d="M5 20.6V9l4-2.5v14.1" />
      <path d="M9 20.6v-8.4l5-2.5v10.9" />
      <path d="M14 20.6V9.9l5 3v7.7" />
    </>
  ),

  // ── process, principles, philosophy, chapters ─────────────────────
  conversation: (
    <>
      <path d="M20.8 11.6c0 3.9-3.7 7.1-8.3 7.1-1.1 0-2.2-.2-3.2-.5l-5.5 2 1.6-4.1c-1.3-1.3-2.1-3-2.1-4.5 0-3.9 3.7-7.1 8.3-7.1s9.2 3.2 9.2 7.1Z" />
    </>
  ),
  document: (
    <>
      <path d="M6 2.8h8.4L18 6.4v14.8H6Z" />
      <path d="M14.4 2.8v3.6H18" />
      <path d="M8.8 11.4h6.4M8.8 14.8h6.4M8.8 8h3.2" />
    </>
  ),
  courthouse: (
    <>
      <path d="M3 9.6 12 4.2l9 5.4" />
      <path d="M5.6 9.6v8M9.6 9.6v8M14.4 9.6v8M18.4 9.6v8" />
      <path d="M4 17.6h16" />
      <path d="M2.6 20.6h18.8" />
    </>
  ),
  seal: (
    <>
      <circle cx="12" cy="9.6" r="5.8" />
      <path d="M8.4 14.6 7 21.4l5-2.4 5 2.4-1.4-6.8" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M15.6 8.4 13.6 13.6 8.4 15.6 10.4 10.4Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.8v5.4l3.4 2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.6" cy="12" r="4.2" />
      <path d="M11.8 12h9" />
      <path d="M17.4 12v3.4M20.4 12v2.6" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="0.9" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.7-6.4 10-6.4S22 12 22 12s-3.7 6.4-10 6.4S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.9" />
    </>
  ),
  hand: (
    <>
      <path d="M12 20.4S3.6 15.1 3.6 9.6A4.5 4.5 0 0 1 12 7.1a4.5 4.5 0 0 1 8.4 2.5c0 5.5-8.4 10.8-8.4 10.8Z" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.6v13" />
      <path d="M12 6.6C10.5 5.1 8 4.6 3.4 4.6v13c4.6 0 7.1.5 8.6 2 1.5-1.5 4-2 8.6-2v-13c-4.6 0-7.1.5-8.6 2Z" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7.8" r="3.6" />
      <path d="M4.6 20.6c0-4.1 3.3-6.6 7.4-6.6s7.4 2.5 7.4 6.6" />
    </>
  ),
  grid: (
    <>
      <rect x="3.4" y="3.4" width="7" height="7" />
      <rect x="13.6" y="3.4" width="7" height="7" />
      <rect x="3.4" y="13.6" width="7" height="7" />
      <rect x="13.6" y="13.6" width="7" height="7" />
    </>
  ),
  question: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.5c0 1.7-2.5 2-2.5 3.6" />
      <path d="M12 17.2h.01" />
    </>
  ),
  diamond: <path d="M12 4.4 19.6 12 12 19.6 4.4 12Z" />,
};

// slug → mark. Every practice area and every industry carries its own; the
// landmark cases and the home practice list borrow whichever one matches the
// area they belong to, so the same subject is always drawn the same way.
const PRACTICE = {
  'civil-litigation': 'balance',
  'criminal-law': 'shield',
  'constitutional-writ-practice': 'colonnade',
  'corporate-commercial-law': 'tower',
  'banking-financial-laws': 'coins',
  'insolvency-bankruptcy': 'hourglass',
  'taxation-laws': 'ledger',
  'labour-employment-law': 'people',
  'intellectual-property-rights': 'mark_ip',
  'real-estate-infrastructure': 'house',
  'family-succession-matters': 'rings',
  'consumer-product-liability': 'tag',
};

const INDUSTRY = {
  'banking-nbfcs': 'coins',
  'real-estate-developers': 'house',
  'corporate-startups': 'tower',
  'insurance-companies': 'shield',
  'healthcare-hospitals': 'care',
  'educational-institutions': 'mortarboard',
  'manufacturing-trading': 'works',
  'housing-societies-rwas': 'blocks',
};

// Ordered lists, indexed the way the numerals they replaced were: these sit
// beside content that is itself an ordered list in the data.
export const PROCESS_ICONS = ['conversation', 'document', 'courthouse', 'key'];
export const PRINCIPLE_ICONS = ['document', 'compass', 'clock', 'seal'];
export const PHILOSOPHY_ICONS = ['target', 'eye', 'hand'];

export const practiceIcon = slug => PRACTICE[slug] || 'diamond';
export const industryIcon = slug => INDUSTRY[slug] || 'diamond';

export default function Icon({ name, className = '', style }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={style}
    >
      {PATHS[name] || PATHS.diamond}
    </svg>
  );
}
