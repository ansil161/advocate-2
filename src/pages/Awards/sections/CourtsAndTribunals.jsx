import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MQ, rise } from '../motion.js';
import { forums } from '../../../data/awards.js';
import bgImg from '../../../assets/img/colonnade-diagonal.webp';

// REGULAR APPEARANCES — a vertical editorial list, not a card grid. Exactly one
// institution is active at a time: the reading line sits at 55% of the viewport,
// and because the items are contiguous, whichever one crosses it takes the black.
export default function CourtsAndTribunals() {
  const rootRef = useRef(null);
  const counterRef = useRef(null);
  const total = String(forums.length).padStart(2, '0');

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.awc__aside > *', { trigger: '.awc__aside', stagger: 0.1 });
        rise('.awc__item', { trigger: '.awc__list', y: 34, stagger: 0.07 });

        gsap.utils.toArray('.awc__item').forEach((item, i) => {
          ScrollTrigger.create({
            trigger: item,
            start: 'top 55%',
            end: 'bottom 55%',
            onToggle: (self) => {
              item.classList.toggle('is-active', self.isActive);
              if (self.isActive && counterRef.current) {
                counterRef.current.textContent = String(i + 1).padStart(2, '0');
              }
            },
          });
        });
      });

      mm.add(MQ.cinematic, () => {
        gsap.to('.awc__bg', {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awc" id="aw-courts" ref={rootRef}>
      <div className="awc__bg" aria-hidden="true">
        <img src={bgImg} alt="" loading="lazy" />
      </div>

      <div className="container awc__grid">
        <aside className="awc__aside">
          <span className="aw-label">Regular Appearances</span>
          <h2 className="awc__title">
            Where the record<br /><em>is made.</em>
          </h2>
          <p className="awc__note">
            The forums the firm appears before, with the practice areas argued in each.
          </p>
          <span className="awc__counter">
            <b ref={counterRef}>01</b> / {total}
          </span>
        </aside>

        <ol className="awc__list">
          {forums.map((f, i) => (
            <li className="awc__item" key={f.name}>
              <span className="awc__item-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="awc__item-name">{f.name}</span>
              {f.domains.length > 0 && (
                <span className="awc__item-domains">{f.domains.join('  ·  ')}</span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
