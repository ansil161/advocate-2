import { useRef } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { useAppReady } from '../../../lib/appReady.js';
import { scrollToHash } from '../../../lib/useLenis.js';
import benchImg from '../../../assets/team/bench-portrait.jpg';

const EASE = [0.16, 1, 0.3, 1];

// Three facts, read off data/team.js and the firm's own history. They sit under
// the headline as a rule-separated row rather than as a stats band, because
// this is a caption on a photograph, not a scoreboard.
const META = [
  ['Eleven', 'advocates on the bench'],
  ['75+', 'years across the bar'],
  ['1996', 'enrolled, Bar Council'],
];

/**
 * Movement I — "The Bench".
 *
 * One photograph, full bleed, and the type sitting in the dark at the bottom of
 * it. Nothing is composited and nothing is interactive: the picture is the
 * hero, and everything else in here exists to keep it readable — a scrim under
 * the words, a vignette to close the frame, and a slow push-in so the room
 * arrives rather than appears.
 *
 * The one deliberate restraint: the headline block is anchored bottom-left
 * against the floor of the frame, not centred over the group. Centred type on a
 * symmetrical group portrait fights the subject for the middle of the picture;
 * hung off the corner it reads as a caption and lets the bench keep the frame.
 */
export default function TeamArrival() {
  const stageRef = useRef(null);
  const reduce = useReducedMotion();

  // The site renders behind `visibility: hidden` until the preloader lifts, so
  // a mount-time entrance would play to nobody. Hold until it is on screen.
  const ready = useAppReady();
  const settled = reduce || ready;

  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end start'],
  });

  // One custom property per frame, written straight to the element — the photo
  // and the type then parallax at different rates in plain CSS, off the React
  // render path entirely.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (!reduce) stageRef.current?.style.setProperty('--sp', v.toFixed(4));
  });

  const rise = (delay) => ({
    initial: reduce ? false : { opacity: 0, y: 22 },
    animate: settled ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 },
    transition: { duration: 1, delay, ease: EASE },
  });

  return (
    <section className="t-bp" id="t-arrival" ref={stageRef}>
      {/* --- the photograph ------------------------------------------------ */}
      <motion.div
        className="t-bp__shot"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, scale: 1.09 }}
        animate={settled ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.09 }}
        transition={{ duration: 2.6, ease: EASE }}
      >
        <img
          src={benchImg}
          alt="The advocates of SLA Advocates standing together in the firm's library."
          fetchPriority="high"
          decoding="async"
        />
      </motion.div>

      <span className="t-bp__scrim" aria-hidden="true" />
      <span className="t-bp__vignette" aria-hidden="true" />

      {/* --- the caption ---------------------------------------------------- */}
      <div className="container t-bp__head">
        <motion.span className="t-bp__eyebrow" {...rise(0.15)}>
          SLA Advocates — The Bench
        </motion.span>
        <motion.span
          className="t-bp__rule"
          aria-hidden="true"
          initial={reduce ? false : { scaleX: 0 }}
          animate={settled ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
        />
        {/* SplitText plays on `whileInView` and this section is in view at
            mount, hidden or not — re-keying remounts it once the page is
            actually being looked at. */}
        <h1 className="t-bp__headline" key={settled ? 'live' : 'held'}>
          <SplitText text="A case is only as good" as="span" delay={0.42} />
          <SplitText text="as the people carrying it." as="span" delay={0.56} />
        </h1>

        <motion.p className="t-bp__sub" {...rise(0.95)}>
          Eleven advocates, and one senior advocate&rsquo;s signature on every
          file that leaves the office.
        </motion.p>

        <motion.dl className="t-bp__meta" {...rise(1.15)}>
          {META.map(([figure, label]) => (
            <div className="t-bp__fact" key={label}>
              <dt>{figure}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </motion.dl>

        <motion.div className="t-bp__actions" {...rise(1.3)}>
          <button type="button" className="t-bp__cta" onClick={() => scrollToHash('#t-bench')}>
            <span>Meet the bench</span>
            <i aria-hidden="true">↓</i>
          </button>
        </motion.div>
      </div>
    </section>
  );
}
