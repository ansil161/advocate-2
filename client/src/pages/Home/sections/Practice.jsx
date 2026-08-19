import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import Reveal, { RevealGroup, RevealItem } from '../../../components/ui/Reveal.jsx';
import { practiceAreas } from '../../../data/practiceAreas.js';
import { chamberImage } from '../../PracticeAreas/lib/practiceImagery.js';

// 6 core practice domains
const featuredPractices = practiceAreas.slice(0, 6);
const EASE = [0.16, 1, 0.3, 1];

export default function Practice() {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  return (
    <section className="exp-rich" id="practice">
      {/* Rich Ambient Glowing Backdrop */}
      <div className="exp-rich__ambient-mesh" aria-hidden="true" />

      <div className="container">
        {/* ── Section Header (No Numbers) ── */}
        <header className="exp-rich__head">
          <Reveal y={25} amount={0.25}>
            <div className="exp-rich__badge">
              <span className="exp-rich__badge-dot" />
              <span>CORE PRACTICE &amp; ADVOCACY DOMAINS</span>
            </div>

            <h2 className="exp-rich__title">
              <SplitText text="Strategic counsel." as="span" />
              <br />
              <SplitText text="Decisive courtroom authority." as="span" />
            </h2>

            <p className="exp-rich__lede">
              We concentrate our counsel within legal domains where thirty years of continuous High Court and trial experience provide decisive authority and strategic clarity.
            </p>
          </Reveal>
        </header>

        {/* ── Rich Visual 3-Column Feature Grid (Zero Numbers) ── */}
        <RevealGroup className="exp-rich__grid" stagger={0.08} amount={0.15}>
          {featuredPractices.map((p, idx) => {
            const isHovered = hoveredIdx === idx;
            const cardImg = chamberImage(p.slug);

            return (
              <RevealItem
                as="div"
                key={p.slug}
                className={`rich-card ${isHovered ? 'is-hovered' : ''}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="rich-card__inner"
                >
                  <Link to={`/practice/${p.slug}`} className="rich-card__link">
                    {/* Rich Background Photographic Layer */}
                    <div className="rich-card__bg-wrap">
                      <img
                        src={cardImg.src}
                        srcSet={cardImg.srcSet}
                        sizes="(max-width: 768px) 100vw, 420px"
                        alt={p.title}
                        loading="lazy"
                      />
                      <div className="rich-card__scrim" />
                    </div>

                    {/* Top Pill Category Tag (No Numbers) */}
                    <div className="rich-card__top">
                      <span className="rich-card__cat-pill">
                        {p.forums[0] || 'ADVISORY PRACTICE'}
                      </span>
                    </div>

                    {/* Bottom Card Copy */}
                    <div className="rich-card__body">
                      <h3 className="rich-card__title">{p.title}</h3>
                      <p className="rich-card__desc">{p.short}</p>

                      <div className="rich-card__foot">
                        <span className="rich-card__forums">
                          {p.forums.slice(0, 2).join(' · ')}
                        </span>
                        <span className="rich-card__action">
                          <span>Explore Domain</span>
                          <span className="rich-card__arrow" aria-hidden="true">→</span>
                        </span>
                      </div>
                    </div>

                    {/* Glowing Platinum Edge Line */}
                    <div className="rich-card__edge-line" />
                  </Link>
                </motion.div>
              </RevealItem>
            );
          })}
        </RevealGroup>

        {/* ── Section Footer Route ── */}
        <Reveal className="exp-rich__foot" y={20} amount={0.2}>
          <div className="exp-rich__foot-left">
            <span className="exp-rich__foot-label">PRACTICE SPECTRUM</span>
            <span className="exp-rich__foot-text">
              Comprehensive representation across 12 legal domains, High Courts, and specialized tribunals.
            </span>
          </div>

          <motion.div whileHover={{ x: 4 }}>
            <Link to="/practice" className="exp-rich__foot-link">
              <span>Explore Full Practice Directory</span>
              <span className="exp-rich__foot-arrow" aria-hidden="true">→</span>
            </Link>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}
