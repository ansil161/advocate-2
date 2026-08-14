import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import Icon, { industryIcon } from '../../../components/ui/Icon.jsx';
import Reveal, { RevealGroup, RevealItem } from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { industries } from '../../../data/industries.js';

// INDUSTRIES — the sector index, presented as a dark panel inset in the cream page
// rather than a full-bleed band. The curve is the section's motif: the panel's own
// radius, the concentric arcs bled into its top-right, the rounded sector cards and
// the pill-shaped ticker at the foot. The marquee is kept as ambient texture only —
// the cards carry the actual content.
export default function Industries() {
  // Pointer-tracked gold wash on each card. Written straight to CSS custom
  // properties so the paint stays on the compositor and React never re-renders.
  const trackPointer = useCallback((e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  const ticker = industries.map(i => <span key={i.slug}>{i.name}</span>);

  return (
    <section className="industries" id="industries">
      <div className="container">
        <div className="industries__panel">
          <span className="industries__grain" aria-hidden="true" />

          {/* Concentric arcs — the curve motif, bled off the panel's top-right corner. */}
          <svg className="industries__arcs" viewBox="0 0 600 600" aria-hidden="true">
            <g fill="none" stroke="currentColor">
              <circle cx="600" cy="0" r="200" />
              <circle cx="600" cy="0" r="320" />
              <circle cx="600" cy="0" r="440" />
              <circle cx="600" cy="0" r="560" />
            </g>
          </svg>

          <header className="industries__head">
            <div className="industries__head-left">
              <span className="eyebrow eyebrow--light"><SplitText text="Industries We Serve" /></span>
              <h2 className="industries__title">
                <SplitText text="Sector fluency," as="div" />
                <SplitText text="not generic counsel." as="div" />
              </h2>
            </div>
            <Reveal as="div" className="industries__head-right" delay={0.1}>
              <p className="industries__note">
                Every mandate is argued in the language of the business behind it —
                the regulator, the paperwork and the commercial pressure that come
                with the sector.
              </p>
              <span className="industries__count">
                <b>Eight</b> sectors advised
              </span>
            </Reveal>
          </header>

          <RevealGroup className="industries__grid" stagger={0.07} amount={0.1}>
            {industries.map(ind => (
              <RevealItem
                as={Link}
                key={ind.slug}
                to={`/industries/${ind.slug}`}
                className="ind-card"
                onPointerMove={trackPointer}
              >
                <span className="ind-card__glow" aria-hidden="true" />
                <span className="ind-card__arc" aria-hidden="true" />
                <span className="ind-card__idx"><Icon name={industryIcon(ind.slug)} /></span>
                <h3 className="ind-card__name">{ind.name}</h3>
                <p className="ind-card__note">{ind.note}</p>
                <span className="ind-card__go">
                  <i>View sector</i>
                  <b aria-hidden="true">→</b>
                </span>
              </RevealItem>
            ))}
          </RevealGroup>

          <div className="industries__ticker">
            <div className="marquee">
              <div className="marquee__track">{ticker}</div>
              <div className="marquee__track" aria-hidden="true">{ticker}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
