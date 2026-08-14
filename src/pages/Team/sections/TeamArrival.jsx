import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { team } from '../../../data/team.js';
import { philosophy } from '../../../data/firm.js';
import { figureFor, figureVars } from '../lib/lineup.js';

const EASE = [0.16, 1, 0.3, 1];

const BENCH = team.filter(a => figureFor(a.slug));

/**
 * Movement I — "The Lineup".
 *
 * The whole bench stands in one row on a black stage, heads on a common line,
 * reflected in the floor beneath them. At rest the row is dark and even;
 * pointing at an advocate lights them, sinks everyone else, and names them on
 * a plate at chest height.
 *
 * Laid out the way the reference is: a heading and a hover cue, then the row,
 * then a single pull quote. The card, the arrows and the stage colours are all
 * taken from the reference's own CSS rather than eyeballed.
 *
 * Where this departs from it is in construction. The reference is one flat
 * group photograph with a hand-traced clip-path per person, used both as the
 * hit area and to mask in a brighter copy of the same photo on hover. The
 * bench was never photographed together, so this is eleven separate cut-outs
 * instead — which is more work to align, but lets each figure be lit, lifted
 * and dimmed independently.
 *
 * The figures are sized to stand tall rather than to all fit, so the row runs
 * past the viewport and the arrows page through it — again as the reference
 * does. They render twice: once upright, once as the reflection. The second
 * pass is a copy of the same row, mirrored about the floor line, so it stays
 * in register with the first for free.
 */
export default function TeamArrival({ onSelect }) {
  const [active, setActive] = useState(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const viewportRef = useRef(null);
  const reduce = useReducedMotion();

  const syncEdges = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    syncEdges();
    // The arrows depend on how many figures fit, which changes with the
    // viewport — and `--head` is a clamp(), so a resize restyles the row too.
    const ro = new ResizeObserver(syncEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEdges]);

  const nudge = dir => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.66, behavior: reduce ? 'auto' : 'smooth' });
  };

  // With a pointer, hover has already named the figure by the time it is
  // clicked, so the click opens the profile. With touch there is no hover, so
  // the first tap names and the second opens.
  const choose = i => {
    if (active !== i) setActive(i);
    else onSelect?.(BENCH[i].slug);
  };

  const row = mirror => (
    <div
      className={`t-lineup__row t-lineup__row--${mirror ? 'mirror' : 'figures'}`}
      aria-hidden="true"
    >
      {BENCH.map((a, i) => (
        <div
          className={`t-lineup__slot${active === i ? ' is-active' : ''}`}
          key={a.slug}
          style={figureVars(a.slug)}
        >
          {/* Nothing here is lazy, not even the figures that start off-screen
              on a narrow viewport: they sit in a horizontal scroller, and a
              browser that skips one at first layout does not reliably come
              back for it when a resize brings it into view — which leaves a
              hole in the row. Eleven cut-outs is ~500 KB, and they are the
              hero. */}
          <img
            className="t-lineup__fig"
            src={figureFor(a.slug).src}
            alt=""
            draggable="false"
            loading="eager"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );

  return (
    <section className="t-lineup" id="t-arrival">
      <div className="t-lineup__stars" aria-hidden="true" />
      <div className="t-lineup__glow" aria-hidden="true" />

      <div className="container t-lineup__head">
        <span className="eyebrow eyebrow--light">The Team — Eleven Advocates</span>
        <motion.span
          className="t-lineup__rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
        />
        <h1 className="h1 h2--light t-lineup__headline">
          <SplitText text="A case is only as good" as="div" delay={0.35} />
          <SplitText text="as the people carrying it." as="div" delay={0.5} />
        </h1>
        <motion.p
          className="t-lineup__sub"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.05, ease: EASE }}
        >
          Hover over the bench to meet them. Seventy-five-plus years of courtroom
          experience across eleven advocates — and one senior advocate&rsquo;s
          signature on every file that leaves the office.
        </motion.p>
      </div>

      {/* Laid out as the reference lays it out: a 1200px rail with the row in
          the middle and a button either side of it, rather than buttons
          floating over the photograph. */}
      <motion.div
        className="t-lineup__rail"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        <button
          type="button"
          className="t-lineup__nav t-lineup__nav--prev"
          onClick={() => nudge(-1)}
          disabled={edges.start}
          aria-label="Previous advocates"
        >
          {/* Lucide chevron-left, the same icon and geometry the reference
              uses, at its md size. */}
          <svg
            className="t-lineup__chev"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <div
          className={`t-lineup__stage${active !== null ? ' is-picking' : ''}`}
          onMouseLeave={() => setActive(null)}
        >
          <div className="t-lineup__viewport" ref={viewportRef} onScroll={syncEdges}>
            <div className="t-lineup__track">
              {row(false)}
              {row(true)}

              {/* Names and hit targets ride above both passes so a plate is
                  never occluded by the next advocate along. */}
              <div className="t-lineup__row t-lineup__row--hit">
                {BENCH.map((a, i) => (
                  <div
                    className={`t-lineup__slot${active === i ? ' is-active' : ''}`}
                    key={a.slug}
                    style={figureVars(a.slug)}
                  >
                    <button
                      type="button"
                      className="t-lineup__hit"
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => choose(i)}
                    >
                      <span className="t-lineup__label">{a.name} — {a.role}</span>
                    </button>
                    <span className="t-lineup__plate">
                      <span className="t-lineup__name">{a.name}</span>
                      <span className="t-lineup__role">{a.role}</span>
                      <span className="t-lineup__go">View profile</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <span className="t-lineup__edge t-lineup__edge--left" aria-hidden="true" />
          <span className="t-lineup__edge t-lineup__edge--right" aria-hidden="true" />
        </div>

        <button
          type="button"
          className="t-lineup__nav t-lineup__nav--next"
          onClick={() => nudge(1)}
          disabled={edges.end}
          aria-label="More advocates"
        >
          <svg
            className="t-lineup__chev"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </motion.div>

      <div className="container">
        <motion.blockquote
          className="t-lineup__quote"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          <p>&ldquo;{philosophy.statement}&rdquo;</p>
        </motion.blockquote>
      </div>
    </section>
  );
}
