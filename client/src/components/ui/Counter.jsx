import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export default function Counter({ value, suffix = '', duration = 1.8 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { duration: duration * 1000, bounce: 0 });

  useEffect(() => {
    if (inView) motionVal.set(value);
  }, [inView, value, motionVal]);

  const displayRef = useRef(null);

  useEffect(() => {
    return spring.on('change', v => {
      if (displayRef.current) displayRef.current.textContent = Math.round(v).toLocaleString();
    });
  }, [spring]);

  return (
    <span ref={ref}>
      <span ref={displayRef}>0</span>
      <span className="suffix">{suffix}</span>
    </span>
  );
}
