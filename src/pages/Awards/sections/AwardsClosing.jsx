import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { MQ, rise, EASE } from '../motion.js';
import closingImg from '../../../assets/img/columns-abstract.webp';

// The close: a statement, not a pitch. Two quiet routes onward — nothing is sold here.
export default function AwardsClosing() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: rootRef.current, start: 'top 62%', once: true },
          defaults: { ease: EASE },
        });
        tl.from('.awx__label', { autoAlpha: 0, y: 16, duration: 0.9 })
          .from('.awx__line-inner', { yPercent: 115, duration: 1.2, stagger: 0.1 }, 0.15)
          .from('.awx__rule', { scaleX: 0, duration: 1.2 }, 0.6)
          .from('.awx__note', { autoAlpha: 0, y: 18, duration: 1 }, 0.7);
        rise('.awx__links a', { trigger: '.awx__links', y: 18, stagger: 0.1, start: 'top 92%' });
      });

      mm.add(MQ.cinematic, () => {
        gsap.to('.awx__bg', {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awx" id="aw-closing" ref={rootRef}>
      <div className="awx__bg" aria-hidden="true">
        <img src={closingImg} alt="" loading="lazy" />
      </div>
      <div className="aw-grain" aria-hidden="true" />

      <div className="container awx__inner">
        <span className="aw-label aw-label--light awx__label">In closing</span>
        <h2 className="awx__title">
          <span className="awx__line"><span className="awx__line-inner">The record</span></span>
          <span className="awx__line awx__line--em"><span className="awx__line-inner">continues.</span></span>
        </h2>
        <span className="awx__rule" aria-hidden="true" />
        <p className="awx__note">
          Thirty years of practice. Eleven advocates. One standard that hasn’t moved.
        </p>
        <div className="awx__links">
          <Link to="/about"><span>About SLA</span><i aria-hidden="true">→</i></Link>
          <Link to="/contact"><span>Contact the firm</span><i aria-hidden="true">→</i></Link>
        </div>
      </div>
    </section>
  );
}
