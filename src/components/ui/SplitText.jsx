import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// Word-by-word reveal, used for large serif headlines.
export default function SplitText({ text, as = 'span', className, delay = 0, stagger = 0.045, once = true }) {
  const words = text.split(' ');
  const Component = motion[as] || motion.span;
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            variants={{ hidden: { y: '110%' }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </Component>
  );
}
