import { useState } from 'react';
import { Link } from 'react-router-dom';
import SplitText from '../../../components/ui/SplitText.jsx';
import Reveal, { RevealGroup, RevealItem } from '../../../components/ui/Reveal.jsx';

const ADVOCACY_RECORD = [
  {
    category: 'Financial & Commercial',
    title: 'Banking & Financial Recovery',
    detail: 'Strategic asset recovery, commercial debt resolution, and representation before specialized financial tribunals.',
    scope: 'Institutional Litigation',
  },
  {
    category: 'Real Estate & Property',
    title: 'Property & Estate Disputes',
    detail: 'Resolution of multi-generation property claims, commercial title disputes, and complex land proceedings.',
    scope: 'Civil & Trial Practice',
  },
  {
    category: 'Constitutional & Regulatory',
    title: 'Public Law & High Court Writs',
    detail: 'Advocacy in constitutional writ petitions, statutory enforcement challenges, and public sector administrative appeals.',
    scope: 'Appellate Practice',
  },
  {
    category: 'Corporate & Defense',
    title: 'Specialized Trial & Defense Strategy',
    detail: 'Comprehensive courtroom defense, emergency injunctive relief, and high-stakes dispute resolution for corporations.',
    scope: 'Courtroom Advocacy',
  },
];

export default function Proof() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <section className="proof-platinum" id="proof">
      {/* Subtle Floating Platinum Ambient Glow */}
      <div className="proof-platinum__glow-mesh" aria-hidden="true" />

      <div className="container">
        {/* ── Editorial Header with Stagger Reveal ── */}
        <Reveal className="proof-platinum__head" y={20} amount={0.2}>
          <div className="proof-platinum__eyebrow">
            <span className="proof-platinum__dot" />
            <span>RECORD OF ADVOCACY &amp; STANDING</span>
          </div>

          <h2 className="proof-platinum__title">
            <SplitText text="Built on thirty years of verified advocacy." as="span" />
          </h2>

          <p className="proof-platinum__lede">
            Providing strategic trial representation, corporate counsel, and appellate advocacy before premier judicial forums.
          </p>
        </Reveal>

        {/* ── Platinum Editorial Quad Grid with Staggered Entrance ── */}
        <RevealGroup className="proof-platinum__grid" stagger={0.08} amount={0.15}>
          {ADVOCACY_RECORD.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <RevealItem
                as="div"
                key={item.title}
                className={`platinum-card ${isHovered ? 'is-hovered' : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <div className="platinum-card__top">
                  <span className="platinum-card__cat">{item.category}</span>
                </div>

                <h3 className="platinum-card__title">{item.title}</h3>
                <p className="platinum-card__detail">{item.detail}</p>

                <div className="platinum-card__foot">
                  <span className="platinum-card__scope">{item.scope}</span>
                  <Link to="/landmark-cases" className="platinum-card__link">
                    <span>Explore</span>
                    <span className="platinum-card__arrow" aria-hidden="true">→</span>
                  </Link>
                </div>

                <div className="platinum-card__border-glow" />
              </RevealItem>
            );
          })}
        </RevealGroup>

        {/* ── Section Footer ── */}
        <Reveal className="proof-platinum__foot" y={15} amount={0.2}>
          <span className="proof-platinum__foot-text">
            Established in 1996 · Continuous trial and appellate presence across High Courts and specialized tribunals.
          </span>
          <Link to="/landmark-cases" className="proof-platinum__foot-link">
            <span>Examine Full Case Directory</span>
            <span className="proof-platinum__foot-arrow" aria-hidden="true">→</span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
