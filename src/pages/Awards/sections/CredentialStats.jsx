import { motion } from 'framer-motion';
import Counter from '../../../components/ui/Counter.jsx';

const EASE = [0.16, 1, 0.3, 1];

export default function CredentialStats({ items }) {
  return (
    <div className="rec-wall">
      {items.map((c, i) => (
        <motion.div
          className="rec-stat"
          key={c.label}
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
        >
          <span className="rec-stat__index">{String(i + 1).padStart(2, '0')}</span>
          <div className="rec-stat__value">
            {c.value != null ? <Counter value={c.value} suffix={c.suffix} /> : c.display}
          </div>
          <div className="rec-stat__label">{c.label}</div>
          <motion.span
            className="rec-stat__bar"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.9, delay: i * 0.08 + 0.15, ease: EASE }}
          />
        </motion.div>
      ))}
    </div>
  );
}
