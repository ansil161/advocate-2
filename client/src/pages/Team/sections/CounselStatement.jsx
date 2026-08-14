import { useRef } from 'react';
import { motion, useScroll, useTransform, useMotionTemplate, useReducedMotion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import statementImg from '../../../assets/img/bench-desk.webp';

const STATS = [
  { value: '11', label: 'Advocates on the bench' },
  { value: '75+', label: 'Combined years in court' },
  { value: '3,600+', label: 'Matters carried' },
];

/**
 * Movement III — "The Standard".
 *
 * A dark interlude between the roster and the culture chapter. The image
 * behind the statement widens out of a narrow column as the section is
 * scrolled, echoing the hero's aperture at a smaller scale.
 */
export default function CounselStatement() {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const insetX = useTransform(scrollYProgress, [0.1, 0.62], [26, 0]);
  const clipPath = useMotionTemplate`inset(0% ${insetX}% 0% ${insetX}%)`;
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.22, 1.02]);
  const imgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <div className="t-standard" ref={ref}>
      <motion.div
        className="t-standard__frame"
        style={reduce ? undefined : { clipPath }}
        aria-hidden="true"
      >
        <motion.img
          src={statementImg}
          alt=""
          style={reduce ? undefined : { scale: imgScale, y: imgY }}
        />
      </motion.div>

      <div className="container t-standard__content">
        <span className="eyebrow eyebrow--light">The Standard</span>
        <h2 className="h2 h2--light t-standard__quote">
          <SplitText text="No file leaves this office" as="div" />
          <SplitText text="without a senior having read it." as="div" delay={0.12} />
        </h2>

        <div className="t-standard__stats">
          {STATS.map((s, i) => (
            <motion.div
              className="t-standard__stat"
              key={s.label}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.75, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="t-standard__statValue">{s.value}</span>
              <span className="t-standard__statLabel">{s.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
