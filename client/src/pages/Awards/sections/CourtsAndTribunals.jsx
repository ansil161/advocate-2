import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplitText from '../../../components/ui/SplitText.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { forums } from '../../../data/awards.js';

gsap.registerPlugin(ScrollTrigger);

const FORUM_ICONS = {
  'High Court of Telangana': 'colonnade',
  'City Civil Courts, Hyderabad': 'house',
  'District Courts': 'shield',
  'Debt Recovery Tribunal (DRT)': 'coins',
  'National Company Law Tribunal (NCLT)': 'tower',
  'Consumer Commissions': 'tag',
  'Labour Courts': 'people',
};

export default function CourtsAndTribunals() {
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const ribbonRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 1. Ambient background glow pulse on scroll
      gsap.fromTo(
        '.awc__bg-glow',
        { scale: 0.75, opacity: 0.3 },
        {
          scale: 1.2,
          opacity: 0.95,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 80%',
            end: 'bottom 20%',
            scrub: 1,
          },
        }
      );

      // 2. Premium 3D Bento Card Stagger Entrance
      if (gridRef.current) {
        const cards = gridRef.current.querySelectorAll('.awc-card');
        gsap.fromTo(
          cards,
          { opacity: 0, y: 55, rotateX: 10, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.85,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: gridRef.current,
              start: 'top 82%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }

      // 3. Stats Ribbon reveal animation
      if (ribbonRef.current) {
        gsap.fromTo(
          ribbonRef.current,
          { opacity: 0, y: 35, scale: 0.98 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: ribbonRef.current,
              start: 'top 88%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awc" id="aw-courts" ref={rootRef}>
      <div className="awc__bg-glow" aria-hidden="true" />
      <div className="container">
        <div className="awc__head">
          <span className="eyebrow eyebrow--light"><SplitText text="Regular Appearances & Forums" /></span>
          <h2 className="h2 h2--light">
            <SplitText text="Institutional Representation & Practice Record." as="div" />
          </h2>
          <p className="awc__sub">
            Active litigation presence before the High Court, Commercial Tribunals, and Appellate Benches.
          </p>
        </div>

        {/* ULTRA-MODERN DARK LUXURY FORUM BENTO GRID */}
        <div className="awc__grid-cards" ref={gridRef}>
          {forums.map((f) => (
            <article key={f.name} className="awc-card">
              <div className="awc-card__glow" aria-hidden="true" />
              
              <div className="awc-card__top">
                <div className="awc-card__icon-box">
                  <div className="awc-card__icon-wrapper">
                    <Icon name={FORUM_ICONS[f.name] || 'diamond'} className="awc-card__icon" />
                  </div>
                </div>
                <span className="awc-card__status-tag">Active Forum</span>
              </div>

              <div className="awc-card__body">
                <h3 className="awc-card__title">{f.name}</h3>

                <div className="awc-card__domains-block">
                  <span className="awc-card__domains-lbl">Key Practice Domains ({f.domains.length})</span>
                  <div className="awc-card__domains-tags">
                    {f.domains.map(d => (
                      <span key={d} className="awc-card__tag">{d}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="awc-card__footer">
                <span className="awc-card__pulse-dot" aria-hidden="true" />
                <span className="awc-card__foot-text">Active Filings & Matters</span>
                <span className="awc-card__arrow">→</span>
              </div>
            </article>
          ))}
        </div>

        {/* MODERN EXECUTIVE STATS RIBBON */}
        <div ref={ribbonRef} className="awc__stats-ribbon">
          <div className="awc-stat-item">
            <span className="stat-num">07</span>
            <span className="stat-lbl">Major Judicial & Legal Forums</span>
          </div>
          <div className="awc-stat-divider" aria-hidden="true" />
          <div className="awc-stat-item">
            <span className="stat-num">HC & TS</span>
            <span className="stat-lbl">High Court & Appellate Benches</span>
          </div>
          <div className="awc-stat-divider" aria-hidden="true" />
          <div className="awc-stat-item">
            <span className="stat-num">2000+</span>
            <span className="stat-lbl">Litigation Files Argued</span>
          </div>
        </div>
      </div>
    </section>
  );
}



