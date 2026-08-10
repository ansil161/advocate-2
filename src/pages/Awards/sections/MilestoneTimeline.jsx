import { useRef } from 'react';
import { motion, useScroll } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function MilestoneTimeline({ items }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.4'] });

  return (
    <div className="ms-timeline" ref={ref}>
      <motion.div className="ms-timeline__rail" style={{ scaleY: scrollYProgress }} />
      {items.map((m, i) => (
        <motion.div
          className="ms-timeline__item"
          key={m.year}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, delay: (i % 3) * 0.06, ease: EASE }}
        >
          <span className="ms-timeline__index">{String(i + 1).padStart(2, '0')}</span>
          <span className="ms-timeline__year">{m.year}</span>
          <div className="ms-timeline__body">
            <h4>{m.title}</h4>
            <p>{m.body}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
