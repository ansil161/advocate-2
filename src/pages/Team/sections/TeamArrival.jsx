import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { team } from '../../../data/team.js';
import { photoFor } from '../lib/teamPhotos.js';

const EASE = [0.16, 1, 0.3, 1];

// Four columns of the real bench, dealt round-robin so no column repeats a
// face and no two neighbours start on the same one.
const COLUMN_COUNT = 4;
const PER_COLUMN = 4;
const COLUMNS = Array.from({ length: COLUMN_COUNT }, (_, c) =>
  Array.from({ length: PER_COLUMN }, (_, r) => team[(c * PER_COLUMN + r) % team.length])
);

// Alternating drift so the wall breathes against itself rather than sliding
// as one block. Percentages are of each column's own height.
const DRIFT = [
  ['1%', '-13%'],
  ['-12%', '2%'],
  ['3%', '-16%'],
  ['-9%', '4%'],
];

/**
 * Movement I — "The Wall".
 *
 * The bench itself is the hero: eleven real portraits in counter-drifting
 * columns behind a statement that holds completely still. The motion belongs
 * to the photographs, never to the sentence — the line resolves once and stays
 * resolved, then hands off by fading as the wall darkens.
 */
export default function TeamArrival() {
  const wrapRef = useRef(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
  });

  // Hooks can't be called in a loop body conditionally, so all four drifts are
  // declared up front and picked by index below.
  const y0 = useTransform(scrollYProgress, [0, 1], DRIFT[0]);
  const y1 = useTransform(scrollYProgress, [0, 1], DRIFT[1]);
  const y2 = useTransform(scrollYProgress, [0, 1], DRIFT[2]);
  const y3 = useTransform(scrollYProgress, [0, 1], DRIFT[3]);
  const columnY = [y0, y1, y2, y3];

  const wallScale = useTransform(scrollYProgress, [0, 1], [1.06, 1]);
  const scrimOpacity = useTransform(scrollYProgress, [0, 0.55, 1], [0.9, 0.94, 1]);

  const contentOpacity = useTransform(scrollYProgress, [0.58, 0.86], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 0.86], ['0px', '-70px']);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  const wall = (
    <div className="t-arrival__wall" aria-hidden="true">
      {COLUMNS.map((col, c) => (
        <motion.div
          className="t-arrival__col"
          key={c}
          style={reduce ? undefined : { y: columnY[c] }}
        >
          {col.map((person, r) => (
            <div className="t-arrival__tile" key={`${c}-${r}`}>
              <img src={photoFor(person.slug)} alt="" loading={c < 2 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  );

  const content = (
    <>
      <span className="eyebrow eyebrow--light t-arrival__eyebrow">
        The Team — Eleven Advocates
      </span>
      <motion.span
        className="t-arrival__rule"
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.1, delay: 0.25, ease: EASE }}
      />
      <h1 className="h1 h2--light t-arrival__headline">
        <SplitText text="A case is only as good" as="div" delay={0.35} />
        <SplitText text="as the people carrying it." as="div" delay={0.5} />
      </h1>
      <motion.p
        className="t-arrival__sub"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 1.05, ease: EASE }}
      >
        Seventy-five-plus years of courtroom experience across eleven advocates —
        and one senior advocate&rsquo;s signature on every file that leaves the office.
      </motion.p>
    </>
  );

  if (reduce) {
    return (
      <section className="t-arrival t-arrival--static" id="t-arrival">
        {wall}
        <div className="t-arrival__scrim" style={{ opacity: 0.72 }} aria-hidden="true" />
        <div className="container t-arrival__content">{content}</div>
      </section>
    );
  }

  return (
    <div className="t-arrival__wrap" ref={wrapRef} id="t-arrival">
      <section className="t-arrival">
        <motion.div className="t-arrival__wallWrap" style={{ scale: wallScale }}>
          {wall}
        </motion.div>
        <motion.div
          className="t-arrival__scrim"
          style={{ opacity: scrimOpacity }}
          aria-hidden="true"
        />

        <motion.div
          className="container t-arrival__content"
          style={{ opacity: contentOpacity, y: contentY }}
        >
          {content}
        </motion.div>

        <motion.span className="t-arrival__cue" style={{ opacity: cueOpacity }} aria-hidden="true">
          Scroll
        </motion.span>
      </section>
    </div>
  );
}
