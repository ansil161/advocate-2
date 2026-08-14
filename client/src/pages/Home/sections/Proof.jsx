import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon, { practiceIcon } from '../../../components/ui/Icon.jsx';
import Counter from '../../../components/ui/Counter.jsx';
import Reveal, { RevealGroup, RevealItem } from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { credentials } from '../../../data/awards.js';
import { landmarkCases, disclaimer } from '../../../data/landmarkCases.js';

// PROOF — the record, set as a black deed plate: gold foil on a dark ground,
// a double hairline frame with corner ticks, an embossed seal watermark.
//
// Marks carry the ordering, not numerals. Each credential is stamped with the
// instrument it belongs to and each matter with its own practice mark, at badge
// scale in the head and again at watermark scale behind the card — so the eye
// reads the file by its symbol rather than by counting.
const CREDENTIAL_ICONS = ['ledger', 'target', 'seal', 'hourglass'];

export default function Proof() {
  const preview = landmarkCases.slice(0, 3);

  // Pointer-tracked gold wash on the plate, written straight to custom properties
  // so the paint stays on the compositor and React never re-renders.
  const trackPointer = useCallback((e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return (
    <section className="proof" id="proof">
      <span className="proof__grain" aria-hidden="true" />

      <div className="container">
        <div className="proof__head">
          <div>
            <span className="eyebrow eyebrow--light"><SplitText text="Proof, Not Promises" /></span>
            <h2 className="proof__title">
              <SplitText text="Standing built on record," as="div" />
              <SplitText text="not marketing." as="div" />
            </h2>
          </div>
          <div className="proof__head-aside">
            <Reveal as="p" className="proof__lede">
              Enrolled with the Bar Council of Telangana, with regular appearances
              before the High Court, City Civil Courts, DRT and NCLT — our credibility
              is measured in outcomes.
            </Reveal>
            <Reveal delay={0.1}>
              <Link to="/awards" className="link-arrow link-arrow--light">
                <span>See recognition &amp; credentials</span> →
              </Link>
            </Reveal>
          </div>
        </div>

        <Reveal className="proof__plate" y={40} amount={0.1} onPointerMove={trackPointer}>
          <span className="proof__plate-grain" aria-hidden="true" />
          <span className="proof__plate-glow" aria-hidden="true" />
          <span className="proof__frame" aria-hidden="true" />

          {/* Embossed seal — the plate's watermark, bled off the bottom-right corner. */}
          <svg className="proof__seal" viewBox="0 0 200 200" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="100" cy="100" r="92" />
              <circle cx="100" cy="100" r="80" />
              <circle cx="100" cy="100" r="58" strokeDasharray="2 7" />
              <path d="M100 52v96M64 76h72M64 76l-16 34h32ZM136 76l16 34h-32ZM78 148h44" />
            </g>
          </svg>

          <div className="proof__cap">
            <span>The Record</span>
            <i aria-hidden="true" />
            <span>Bar Council of Telangana · Est. 1996</span>
          </div>

          <RevealGroup className="proof__credentials" stagger={0.08} amount={0.3}>
            {credentials.map((c, i) => (
              <RevealItem as="div" className="rec-stat" key={c.label}>
                <span className="rec-stat__mark">
                  <Icon name={CREDENTIAL_ICONS[i] || 'diamond'} />
                </span>
                <div className={`rec-stat__value${c.value === null ? ' rec-stat__value--code' : ''}`}>
                  {c.value === null ? c.display : <Counter value={c.value} suffix={c.suffix} />}
                </div>
                <div className="rec-stat__label">{c.label}</div>
              </RevealItem>
            ))}
          </RevealGroup>

          <div className="proof__ledger">
            <div className="proof__ledger-head">
              <span>Selected Matters</span>
              <i aria-hidden="true" />
              <span>{String(preview.length).padStart(2, '0')} of {landmarkCases.length}</span>
            </div>

            <ol className="proof__files">
              {preview.map((c, i) => (
                <Reveal as="li" className="file-item" key={c.title} delay={0.09 * i} y={24}>
                  <Link to="/landmark-cases" className="file">
                    <span className="file__seam" aria-hidden="true" />
                    <span className="file__ghost" aria-hidden="true">
                      <Icon name={practiceIcon(c.practiceSlug)} />
                    </span>

                    <div className="file__band">
                      <span className="file__mark"><Icon name={practiceIcon(c.practiceSlug)} /></span>
                      <span className="file__rule" aria-hidden="true" />
                    </div>

                    <span className="file__cat">{c.category}</span>
                    <h4 className="file__title">{c.title}</h4>
                    <p className="file__summary">{c.summary}</p>

                    <div className="file__foot">
                      <span className="file__forum"><Icon name="courthouse" />{c.forum}</span>
                      <span className="file__stamp"><Icon name="seal" />{c.outcome}</span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ol>
          </div>

          <div className="proof__foot">
            <p className="proof__note">{disclaimer}</p>
            <Link to="/landmark-cases" className="link-arrow link-arrow--light">
              <span>View landmark cases</span> →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
