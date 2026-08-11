import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MQ, rise } from '../motion.js';
import { recognitionQuote } from '../../../data/awards.js';

// Splits the approved line at its natural mid-point so the two halves can enter
// the viewport apart and settle into one composition. Derived from the string
// itself rather than hard-coded, so editing the quote in data/ can't break it.
function splitAtMiddle(text) {
  const mid = Math.floor(text.length / 2);
  let i = text.indexOf(' ', mid);
  if (i === -1) i = text.lastIndexOf(' ', mid);
  if (i === -1) return [text, ''];
  return [text.slice(0, i), text.slice(i + 1)];
}

const [FIRST, SECOND] = splitAtMiddle(recognitionQuote.quote);

export default function RecognitionStatement() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.aws__label, .aws__attr', { trigger: rootRef.current, start: 'top 70%', stagger: 0.15 });
      });

      mm.add(MQ.cinematic, () => {
        // Fragmented on entry, resolved by the time it's centred: the quote
        // physically settles as the reader arrives at it.
        gsap.from('.aws__frag--a', {
          xPercent: -8,
          autoAlpha: 0.32,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top 85%', end: 'center 58%', scrub: 0.9 },
        });
        gsap.from('.aws__frag--b', {
          xPercent: 10,
          autoAlpha: 0.32,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top 85%', end: 'center 52%', scrub: 0.9 },
        });
        gsap.to('.aws__lines', {
          yPercent: -8,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'bottom top', scrub: 1 },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="aws" id="aw-statement" ref={rootRef}>
      {/* Architectural line drawing — a colonnade reduced to rules. Purely a
          background mark; it doesn't stand in for a photograph or a document. */}
      <div className="aws__lines" aria-hidden="true">
        {/* The colonnade runs past the viewBox on every side so it is cropped by
            the section rather than closing into a drawn box. */}
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
          <path d="M-40 130 L600 40 L1240 130" />
          <line x1="-40" y1="130" x2="1240" y2="130" />
          <line x1="-40" y1="162" x2="1240" y2="162" />
          {[140, 300, 460, 620, 780, 940, 1100].map((x) => (
            <line key={x} x1={x} y1="162" x2={x} y2="680" />
          ))}
        </svg>
      </div>
      <div className="aw-grain" aria-hidden="true" />

      <div className="container aws__inner">
        <span className="aw-label aws__label">Philosophy</span>
        <blockquote className="aws__quote">
          <span className="aws__frag aws__frag--a">{FIRST}</span>
          <span className="aws__frag aws__frag--b">{SECOND}</span>
        </blockquote>
        <span className="aws__attr">— {recognitionQuote.attribution}</span>
      </div>
    </section>
  );
}
