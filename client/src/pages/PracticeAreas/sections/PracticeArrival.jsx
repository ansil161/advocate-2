import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon, { practiceIcon } from '../../../components/ui/Icon.jsx';
import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import heroImg from '../../../assets/img/hero-courthouse.webp';
import heroImg1400 from '../../../assets/img/hero-courthouse-1400.webp';
import heroImg760 from '../../../assets/img/hero-courthouse-760.webp';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  PRACTICE ARRIVAL
// ------------------------------------------------------------
//  Unchanged in composition — number, title, one line of the brief. What is
//  new is the exit: the arrival does not end, it recedes. Its plate pushes
//  past the lens and the type lifts out of frame while the cinematic stage is
//  already rising underneath on the same black ground, so the reader never
//  crosses an edge between the hero and the first chapter.
// ============================================================
export default function PracticeArrival({ practice }) {
  const sectionRef = useRef(null);
  const bgRef = useRef(null);
  const contentRef = useRef(null);
  const cueRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: 1,
            invalidateOnRefresh: true,
          },
        });
        tl.to(bgRef.current, { scale: 1.16, yPercent: 6, autoAlpha: 0.05 }, 0);
        tl.to(contentRef.current, { y: -90, autoAlpha: 0 }, 0);
        tl.to(cueRef.current, { autoAlpha: 0, duration: 0.3 }, 0);
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [practice.slug]);

  return (
    <section className="pd-arrival" id="pd-arrival" ref={sectionRef}>
      <div className="pd-arrival__bg" ref={bgRef} aria-hidden="true">
        {/* Full-bleed (`inset: 0` + object-fit: cover). The original stays the
            widest candidate, so desktop resolves to the same file as before. */}
        <img
          src={heroImg}
          srcSet={`${heroImg760} 760w, ${heroImg1400} 1400w, ${heroImg} 2200w`}
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="container pd-arrival__content" ref={contentRef}>
        <span className="chapter-label chapter-label--light">
          <Icon name={practiceIcon(practice.slug)} /> Practice Areas
        </span>
        <h1 className="h1 h2--light">
          <SplitText text={practice.title} />
        </h1>
        <Reveal as="p" className="pd-arrival__sub">
          {practice.short}
        </Reveal>
      </div>
      <div className="pd-arrival__cue" ref={cueRef} aria-hidden="true">
        <span>Enter the practice</span>
        <i />
      </div>
    </section>
  );
}
