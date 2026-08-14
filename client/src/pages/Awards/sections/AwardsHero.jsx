import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EASE, MQ } from '../motion.js';
import heroImg from '../../../assets/img/hero-courthouse.webp';
import heroImg1400 from '../../../assets/img/hero-courthouse-1400.webp';
import heroImg760 from '../../../assets/img/hero-courthouse-760.webp';

// The opening frame: architecture, held in monochrome, with the page title set as
// an editorial masthead rather than a centred marketing hero. On scroll the camera
// pushes in and darkens — architecture → institution → record.
export default function AwardsHero() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        const tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.from('.awh__img', { scale: 1.14, duration: 2.6, ease: 'power2.out' }, 0)
          .from('.awh__label', { autoAlpha: 0, y: 14, duration: 0.9 }, 0.15)
          .from('.awh__line-inner', { yPercent: 118, duration: 1.15, stagger: 0.1 }, 0.25)
          .from('.awh__statement', { autoAlpha: 0, y: 18, duration: 1 }, 0.75)
          .from('.awh__foot > *', { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.08 }, 0.9)
          .from('.awh__cue', { autoAlpha: 0, duration: 0.8 }, 1.1);
      });

      mm.add(MQ.cinematic, () => {
        // The hero doesn't cut to the next section — it lifts away and dims into it.
        gsap.to('.awh__media', {
          yPercent: 12,
          scale: 1.09,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom top', scrub: 0.6 },
        });
        gsap.to('.awh__dim', {
          opacity: 0.62,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom top', scrub: 0.6 },
        });
        gsap.to('.awh__inner', {
          yPercent: -14,
          autoAlpha: 0,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom 35%', scrub: 0.6 },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awh" id="aw-hero" ref={rootRef}>
      <div className="awh__media" aria-hidden="true">
        {/* `src` stays the full-size file, so it remains the widest candidate and
            a desktop viewport resolves to exactly the image it did before. The
            narrow variants only ever win on small screens — same crop, fewer
            pixels. `.awh__media` is inset -7%/-12%, so the layer is painted a
            little wider than the viewport; sizes says so rather than rounding
            down to 100vw and under-selecting. */}
        <img
          className="awh__img"
          src={heroImg}
          srcSet={`${heroImg760} 760w, ${heroImg1400} 1400w, ${heroImg} 2200w`}
          sizes="115vw"
          alt=""
          fetchPriority="high"
        />
        <div className="awh__scrim" />
        <div className="awh__dim" />
      </div>
      <div className="awh__grid" aria-hidden="true" />
      <div className="aw-grain" aria-hidden="true" />

      <div className="container awh__inner">
        <span className="aw-label aw-label--light awh__label">Recognition — The Record</span>
        <h1 className="awh__title">
          <span className="awh__line"><span className="awh__line-inner">Awards</span></span>
          <span className="awh__line awh__line--amp"><span className="awh__line-inner">&amp;</span></span>
          <span className="awh__line"><span className="awh__line-inner">Recognition</span></span>
        </h1>
        <p className="awh__statement">A record built in court, recognized over time.</p>
      </div>

      <div className="container awh__foot">
        <span><i>Enrolled</i>Bar Council of Telangana, 1996</span>
        <span><i>Practice</i>Hyderabad, Telangana</span>
        <span className="awh__file">SLA / Recognition</span>
      </div>

      <div className="awh__cue" aria-hidden="true">
        <span>Scroll</span>
        <i />
      </div>
    </section>
  );
}
