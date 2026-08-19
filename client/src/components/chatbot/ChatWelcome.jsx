// The empty state — the reference design's centred stack: the mark, the
// two-line greeting, the lede, and (rendered by ChatMessages) the chip row.
//
// It shows only while the transcript is empty. Once there is a conversation to
// read, the transcript is the content and this is replaced by the one-line
// notice in ChatMessages.jsx — holding it above a real exchange would push the
// visitor's own words off the top of the panel.

// The reference's logo tile, kept as drawn: a dark rounded square under three
// stacked inner shadows, with the four-point star in a white gradient and a
// 2px gradient stroke around the edge. Filter and gradient ids are namespaced
// so they cannot collide with the site's other inline SVGs.
function AssistantMark() {
  return (
    <svg
      className="chat-welcome__mark"
      fill="none"
      height="48"
      width="48"
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <filter
        id="chatMarkInner"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height="54"
        width="48"
        x="0"
        y="-3"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feBlend in="SourceGraphic" in2="BackgroundImageFix" mode="normal" result="shape" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset dy="-3" />
        <feGaussianBlur stdDeviation="1.5" />
        <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0" />
        <feBlend in2="shape" mode="normal" result="effect1" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feOffset dy="3" />
        <feGaussianBlur stdDeviation="1.5" />
        <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
        <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.1 0" />
        <feBlend in2="effect1" mode="normal" result="effect2" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feMorphology in="SourceAlpha" operator="erode" radius="1" result="effect3" />
        <feOffset />
        <feComposite in2="hardAlpha" k2="-1" k3="1" operator="arithmetic" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.0627451 0 0 0 0 0.0941176 0 0 0 0 0.156863 0 0 0 0.24 0"
        />
        <feBlend in2="effect2" mode="normal" result="effect3" />
      </filter>

      <filter
        id="chatMarkDrop"
        colorInterpolationFilters="sRGB"
        filterUnits="userSpaceOnUse"
        height="42"
        width="42"
        x="3"
        y="5.25"
      >
        <feFlood floodOpacity="0" result="BackgroundImageFix" />
        <feColorMatrix
          in="SourceAlpha"
          result="hardAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
        />
        <feMorphology in="SourceAlpha" operator="erode" radius="1.5" result="drop" />
        <feOffset dy="2.25" />
        <feGaussianBlur stdDeviation="2.25" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix
          type="matrix"
          values="0 0 0 0 0.141176 0 0 0 0 0.141176 0 0 0 0 0.141176 0 0 0 0.1 0"
        />
        <feBlend in2="BackgroundImageFix" mode="normal" result="drop" />
        <feBlend in="SourceGraphic" in2="drop" mode="normal" result="shape" />
      </filter>

      <linearGradient id="chatMarkSheen" gradientUnits="userSpaceOnUse" x1="24" x2="26" y1="0" y2="48">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset="1" stopColor="#fff" stopOpacity=".12" />
      </linearGradient>
      <linearGradient id="chatMarkStar" gradientUnits="userSpaceOnUse" x1="24" x2="24" y1="6" y2="42">
        <stop offset="0" stopColor="#fff" stopOpacity=".8" />
        <stop offset="1" stopColor="#fff" stopOpacity=".5" />
      </linearGradient>
      <linearGradient id="chatMarkEdge" gradientUnits="userSpaceOnUse" x1="24" x2="24" y1="0" y2="48">
        <stop offset="0" stopColor="#fff" stopOpacity=".12" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id="chatMarkClip">
        <rect height="48" rx="12" width="48" />
      </clipPath>

      <g filter="url(#chatMarkInner)">
        <g clipPath="url(#chatMarkClip)">
          <rect fill="#0A0D12" height="48" rx="12" width="48" />
          <path d="m0 0h48v48h-48z" fill="url(#chatMarkSheen)" />
          <g filter="url(#chatMarkDrop)">
            <path
              clipRule="evenodd"
              d="m6 24c11.4411 0 18-6.5589 18-18 0 11.4411 6.5589 18 18 18-11.4411 0-18 6.5589-18 18 0-11.4411-6.5589-18-18-18z"
              fill="url(#chatMarkStar)"
              fillRule="evenodd"
            />
          </g>
        </g>
        <rect
          height="46"
          rx="11"
          stroke="url(#chatMarkEdge)"
          strokeWidth="2"
          width="46"
          x="1"
          y="1"
        />
      </g>
    </svg>
  );
}

export default function ChatWelcome({ greeting, phone, phoneHref }) {
  return (
    <div className="chat-welcome">
      <AssistantMark />

      <div className="chat-welcome__copy">
        <div className="chat-welcome__greeting">
          <h2 className="chat-welcome__hi">Hi there,</h2>
          <h3 className="chat-welcome__title">Welcome — how can I help?</h3>
        </div>
        {/* The lede comes from the service, so what the assistant says it can
            do stays tied to what the knowledge base actually holds. */}
        {greeting && <p className="chat-welcome__lede">{greeting}</p>}
      </div>
    </div>
  );
}
