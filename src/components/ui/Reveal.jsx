import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

// `as` may be a built-in tag name ('div', 'p', ...) or a custom component
// (e.g. React Router's Link) — motion.create() wraps the latter so it still
// receives the motion props while forwarding the rest (like `to`) correctly.
function resolveMotionComponent(as) {
  if (typeof as === 'string') return motion[as] || motion.div;
  return motion.create(as);
}

export default function Reveal({
  as = 'div',
  children,
  delay = 0,
  y = 28,
  duration = 0.9,
  className,
  once = true,
  amount = 0.2,
  ...rest
}) {
  const Component = resolveMotionComponent(as);
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function RevealGroup({ children, className, stagger = 0.1, once = true, amount = 0.2, ...rest }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ as = 'div', children, className, y = 24, duration = 0.8, ...rest }) {
  const Component = resolveMotionComponent(as);
  return (
    <Component
      className={className}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration, ease: EASE } } }}
      {...rest}
    >
      {children}
    </Component>
  );
}
