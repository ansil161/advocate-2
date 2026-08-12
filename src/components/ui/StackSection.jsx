import { useRef, useState, useLayoutEffect } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
// Structural rules (the sticky pin, the spacer, the negative-margin overlap).
// They travel with the component so every page using it gets them — Team.css
// only loads on the lazily-routed Team page.
import './StackSection.css';

/**
 * A section that pins once it is fully in view and is then covered by the next
 * one sliding up over it, receding slightly as it goes.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. The pin uses a *negative* `top` offset (`viewportH - panelH`), not
 *    `bottom: 0`. Bottom-sticky holds an element that is approaching from
 *    below; it never pulls one back down once it has scrolled past. Offsetting
 *    `top` by the overhang lets a panel taller than the viewport scroll all the
 *    way through and then stop with its last line resting on the fold.
 *
 * 2. The spacer after the panel is what gives the pin somewhere to travel. A
 *    sticky child can only move within its parent's *content* box, so padding
 *    on the wrapper buys no pin distance at all — it has to be real in-flow
 *    height. The next StackSection pulls itself up by the same amount, so it
 *    starts covering exactly when the pin begins and page height is unchanged.
 *
 * Scroll progress is measured on the wrapper, never the panel — a pinned
 * sticky element's bounding rect stops moving, so measuring it would freeze.
 */
export default function StackSection({
  id,
  className = '',
  children,
  depth = 0,
  minScale = 0.93,
  dim = 0.55,
  pin = true,
}) {
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const reduce = useReducedMotion();
  const [stickyTop, setStickyTop] = useState(0);

  useLayoutEffect(() => {
    if (!pin || !panelRef.current) return undefined;
    const el = panelRef.current;
    const measure = () => {
      setStickyTop(Math.min(0, window.innerHeight - el.offsetHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    // Late-loading images inside the panel change its height after the observer
    // has already settled, which would leave the pin offset stale.
    window.addEventListener('load', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
    };
  }, [pin]);

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['end end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0.35, 1], [1, minScale]);
  const opacity = useTransform(scrollYProgress, [0.35, 1], [1, 1 - dim]);

  const style = !pin ? undefined : reduce ? { top: stickyTop } : { top: stickyTop, scale, opacity };

  return (
    <div
      ref={wrapRef}
      className={`t-stack ${pin ? '' : 't-stack--flat'}`}
      style={{ zIndex: depth + 1 }}
    >
      <motion.section
        ref={panelRef}
        id={id}
        className={`t-stack__panel ${className}`}
        style={style}
      >
        {children}
      </motion.section>
      {pin && <div className="t-stack__spacer" aria-hidden="true" />}
    </div>
  );
}
