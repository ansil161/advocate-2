import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { testimonials } from '../../../data/testimonials.js';
import libraryImg from '../../../assets/img/library-moody.webp';

const EASE = [0.16, 1, 0.3, 1];
const COLS = 2;

export default function ClientTestimonials() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-15% 0px -15% 0px' });
  const prefersReducedMotion = useReducedMotion();
  const [active, setActive] = useState(null);
  const [settled, setSettled] = useState(false);

  const total = testimonials.length;
  const mid = (total - 1) / 2;
  const rows = Math.ceil(total / COLS);

  useEffect(() => {
    if (!isInView || prefersReducedMotion) {
      if (prefersReducedMotion) setSettled(true);
      return;
    }
    const timer = setTimeout(() => setSettled(true), total * 90 + 900);
    return () => clearTimeout(timer);
  }, [isInView, total, prefersReducedMotion]);

  const clearActive = (i) => setActive((cur) => (cur === i ? null : cur));

  return (
    <section className="testimonials" id="testimonials" ref={sectionRef}>
      <div className="testimonials__bg" aria-hidden="true"><img src={libraryImg} alt="" /></div>
      <div className="container">
        <span className="eyebrow eyebrow--light"><SplitText text="Client Experience" /></span>
        <h2 className="h2 h2--light">
          <SplitText text="What working with SLA" as="div" />
          <SplitText text="looks like." as="div" />
        </h2>
      </div>

      <div className="testi-fan">
        <div className="testi-fan__glow" aria-hidden="true" />
        {testimonials.map((t, i) => {
          const offset = i - mid;
          const isActive = active === i;
          const rowIdx = Math.floor(i / COLS);
          const colIdx = i % COLS;

          const pos = !isInView
            ? { left: `${((colIdx + 0.5) / COLS) * 100}%`, top: `${((rowIdx + 0.5) / rows) * 100}%` }
            : isActive
            ? { left: '50%', top: '56%' }
            : { left: '50%', top: '68%' };

          const shape = !isInView
            ? { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }
            : isActive
            ? { x: 0, y: -44, rotate: 0, scale: 1.08, opacity: 1 }
            : {
                x: offset * 92,
                y: Math.abs(offset) * 22,
                rotate: offset * 9,
                scale: active !== null ? 0.95 : 1,
                opacity: active !== null ? 0.45 : 1,
              };

          const transition = prefersReducedMotion
            ? { duration: 0.01 }
            : {
                duration: isActive || settled ? 0.55 : 0.9,
                delay: isInView && !settled ? i * 0.09 : 0,
                ease: EASE,
              };

          return (
            <motion.div
              key={i}
              className="testi-fan__pos"
              style={{ zIndex: isActive ? 100 : Math.round((total - Math.abs(offset)) * 10) }}
              initial={false}
              animate={pos}
              transition={transition}
            >
              <motion.div
                className={`testi-fan__card${isActive ? ' is-active' : ''}`}
                initial={false}
                animate={shape}
                transition={transition}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => clearActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => clearActive(i)}
                onClick={() => setActive((cur) => (cur === i ? null : i))}
                tabIndex={0}
                role="button"
                aria-pressed={isActive}
              >
                <div className="testi-fan__stars">★★★★★</div>
                <p className="testi-fan__quote">&ldquo;{t.quote}&rdquo;</p>
                <div className="testi-fan__meta">{t.meta}</div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
