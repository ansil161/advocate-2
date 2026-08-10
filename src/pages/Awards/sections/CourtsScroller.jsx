import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function CourtsScroller({ items }) {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], ['4%', '-62%']);

  return (
    <div className="aw-courts__wrap" ref={wrapRef}>
      <div className="aw-courts__sticky">
        <motion.div className="aw-courts__track" style={{ x }}>
          {items.map((f, i) => (
            <div className="aw-courts__item" key={f}>
              <span className="aw-courts__num">{String(i + 1).padStart(2, '0')}</span>
              <span className="aw-courts__name">{f}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
