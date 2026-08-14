import { useCallback, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { team } from '../../../data/team.js';
import { useAppReady } from '../../../lib/appReady.js';
import { figureFor } from '../lib/lineup.js';
import { RANKS, SPAN, figureVars, placementFor } from '../lib/formation.js';
import chambersImg from '../../../assets/img/bench-chambers.webp';

const EASE = [0.16, 1, 0.3, 1];

// Standing order, back rank first — so the group assembles behind the founder
// and he is the last one to step into the light.
const BENCH = team
  .filter((a) => figureFor(a.slug) && placementFor(a.slug))
  .sort((a, b) => placementFor(b.slug).rank - placementFor(a.slug).rank);

/**
 * Movement I — "The Bench".
 *
 * A staged group portrait. A panelled law-library wall, a warm key light from
 * above, and the whole firm standing in a wedge in front of it: the founder
 * front and centre, the bench fanning back either side of him in five ranks
 * that get smaller, darker and softer with distance.
 *
 * The photograph does not exist — the bench has never been in one frame — so
 * this composites it out of the eleven cut-outs the firm supplied. Three things
 * do the work of a real camera:
 *
 *   depth      one `--d` per figure scales its size, its distance below the
 *              crown line, its brightness and its blur together. Everything a
 *              lens does at f/2 falls out of that single number.
 *   grade      the sources are eleven different shoots — a blue suit here, a
 *              red sari there, daylight and tube light. A common desaturating
 *              grade plus a warm wash masked to each silhouette pulls them onto
 *              one film stock.
 *   shadow     the cut-outs are cropped at wildly different heights. Rather
 *              than hide that, every figure dissolves downward into the dark
 *              the room is already sitting in, so the group reads as lit from
 *              above and lost below rather than pasted onto a background.
 *
 * Motion is all camera, never decoration: the room pushes in on load, the ranks
 * arrive back-to-front, and scrolling dollies the near figures past the far
 * ones. Pointing at an advocate lights them out of the group and names them on
 * a lower third.
 */
export default function TeamArrival({ onSelect }) {
  const [active, setActive] = useState(null);
  const stageRef = useRef(null);
  const reduce = useReducedMotion();

  // On a first visit the preloader is still over the page at mount, and the
  // whole point of this hero is watching the bench gather. `hold` keeps every
  // entrance at its initial frame until the wipe has cleared; `settled` is the
  // final state, which reduced motion goes straight to.
  const ready = useAppReady();
  const hold = !reduce && !ready;
  const settled = reduce || ready;

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end start'],
  });

  // One custom property, written straight to the element — the per-figure
  // parallax is then plain CSS arithmetic off `--d`, which keeps eleven
  // independently-moving figures off the React render path entirely.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduce) stageRef.current?.style.setProperty('--sp', v.toFixed(4));
  });

  // With a pointer, hover has already named the figure by the time it is
  // clicked, so the click opens the profile. With touch there is no hover, so
  // the first tap names and the second opens.
  const choose = useCallback(
    (slug) => {
      setActive((cur) => {
        if (cur === slug) onSelect?.(slug);
        return slug;
      });
    },
    [onSelect]
  );

  const current = active ? BENCH.find((a) => a.slug === active) : null;

  return (
    <section
      className={`t-bp${active ? ' is-picking' : ''}`}
      id="t-arrival"
      ref={stageRef}
      onMouseLeave={() => setActive(null)}
    >
      {/* --- the room ------------------------------------------------------ */}
      <motion.div
        className="t-bp__room"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, scale: 1.16 }}
        animate={settled ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.16 }}
        transition={{ duration: 2.4, ease: EASE }}
      >
        <img src={chambersImg} alt="" fetchPriority="high" decoding="async" />
      </motion.div>
      <span className="t-bp__vignette" aria-hidden="true" />
      <span className="t-bp__key" aria-hidden="true" />
      <span className="t-bp__shaft" aria-hidden="true" />
      <span className="t-bp__motes" aria-hidden="true" />

      {/* --- the title card ------------------------------------------------ */}
      <div className="container t-bp__head">
        <motion.span
          className="eyebrow eyebrow--light t-bp__eyebrow"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={settled ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 1, delay: 0.15, ease: EASE }}
        >
          SLA Advocates — The Bench
        </motion.span>
        <motion.span
          className="t-bp__rule"
          aria-hidden="true"
          initial={reduce ? false : { scaleX: 0 }}
          animate={settled ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
        />
        {/* SplitText plays on `whileInView`, and the section is already in view
            at mount — hidden or not. Re-keying it on `ready` remounts it so the
            words rise once the page is actually being looked at. */}
        <h1 className="h1 h2--light t-bp__headline" key={hold ? 'held' : 'live'}>
          <SplitText text="A case is only as good" as="div" delay={0.4} />
          <SplitText text="as the people carrying it." as="div" delay={0.55} />
        </h1>
        <motion.p
          className="t-bp__sub"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={settled ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 1, delay: 1.15, ease: EASE }}
        >
          Eleven advocates, and one senior advocate&rsquo;s signature on every
          file that leaves the office.
        </motion.p>
      </div>

      {/* --- the group ------------------------------------------------------
          Sized off `--head`, so the whole wedge rescales from one clamp() and
          nothing needs measuring at runtime. */}
      <div className="t-bp__group" style={{ '--span': SPAN }}>
        {BENCH.map((a) => {
          const p = placementFor(a.slug);
          return (
            <motion.div
              className={`t-bp__slot${active === a.slug ? ' is-active' : ''}`}
              key={a.slug}
              style={figureVars(a.slug)}
              initial={reduce ? false : { opacity: 0, y: 34, scale: 0.965 }}
              animate={
                settled ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 34, scale: 0.965 }
              }
              transition={{
                duration: 1.5,
                // Back rank first, the founder last: the group gathers, then he
                // steps into it.
                delay: 0.45 + (RANKS - p.rank) * 0.13,
                ease: EASE,
              }}
            >
              {/* Two wrappers, because three things move this figure and they
                  must not fight over one `transform`: framer owns the slot for
                  the entrance, the scroll owns `__par`, and hover owns
                  `__lift` — the only one of the three that is transitioned. */}
              <div className="t-bp__par">
                <div className="t-bp__lift">
                  {/* Nothing here is lazy. These eleven cut-outs are the hero,
                      and a figure that arrives late leaves a hole in the
                      group. */}
                  <img
                    className="t-bp__fig"
                    src={figureFor(a.slug).src}
                    alt=""
                    draggable="false"
                    loading="eager"
                    decoding="async"
                  />
                  {/* Masked to the figure's own alpha: the warm wash that puts
                      eleven shoots under one lamp, and the gold that lifts one
                      advocate out of the group on hover. */}
                  <span className="t-bp__wash" aria-hidden="true" />
                </div>
              </div>
              <button
                type="button"
                className="t-bp__hit"
                onMouseEnter={() => setActive(a.slug)}
                onFocus={() => setActive(a.slug)}
                onClick={() => choose(a.slug)}
              >
                <span className="t-bp__label">
                  {a.name} — {a.role}. View profile.
                </span>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* The dark the group stands in. Above the figures, so every cut-out —
          full standing shot or tight crop — sinks into the same shadow at the
          same waterline. */}
      <span className="t-bp__floor" aria-hidden="true" />

      {/* --- the lower third ------------------------------------------------ */}
      <div className="t-bp__caption" aria-live="polite">
        <motion.div
          className="t-bp__plate"
          initial={false}
          animate={current ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE }}
        >
          <span className="t-bp__plate-name">{current?.name ?? ' '}</span>
          <span className="t-bp__plate-role">
            {current ? `${current.role} · ${current.exp}` : ' '}
          </span>
          <span className="t-bp__plate-go">View profile</span>
        </motion.div>

        <motion.p
          className="t-bp__cue"
          animate={{ opacity: current || !settled ? 0 : 1 }}
          transition={{ duration: 0.4, delay: current ? 0 : 1.6, ease: EASE }}
          initial={reduce ? false : { opacity: 0 }}
        >
          Point at the bench to meet them
        </motion.p>
      </div>
    </section>
  );
}
