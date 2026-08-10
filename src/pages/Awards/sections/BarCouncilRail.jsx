import { useRef } from 'react';
import { motion, useScroll } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function BarCouncilRail({ rows }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.6'] });

  return (
    <div className="aw-bar__list" ref={ref}>
      <motion.div className="aw-bar__rail" style={{ scaleY: scrollYProgress }} />
      <div className="aw-bar__row aw-bar__row--head">
        <span /><span>Advocate</span><span>Role</span><span>Enrollment No.</span><span>Since</span>
      </div>
      {rows.map((b, i) => (
        <motion.div
          className="aw-bar__row"
          key={b.name}
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
        >
          <span className="aw-bar__index">{String(i + 1).padStart(2, '0')}</span>
          <span>{b.name}</span><span>{b.role}</span><span>{b.enrollment}</span><span>{b.since}</span>
        </motion.div>
      ))}
    </div>
  );
}
