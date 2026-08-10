import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';

export default function ExpertiseScroller({ items }) {
  const wrapRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: wrapRef, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0, 1], ['4%', '-58%']);

  return (
    <div className="t-expertise__wrap" ref={wrapRef}>
      <div className="t-expertise__sticky">
        <motion.div className="t-expertise__track" style={{ x }}>
          {items.map(p => (
            <Link to={`/practice/${p.slug}`} className="t-expertise__item" key={p.slug}>
              <span className="t-expertise__num">{p.n}</span>
              <span className="t-expertise__name">{p.title}</span>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
