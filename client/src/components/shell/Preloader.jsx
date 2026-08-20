import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SlaLogo from '../ui/SlaLogo.jsx';

export default function Preloader({ onDone }) {
  const [phase, setPhase] = useState('letters'); // letters -> bar -> exit -> gone
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('bar'), 500);
    const t2 = setTimeout(() => setPhase('exit'), 1500);
    const t3 = setTimeout(() => { setVisible(false); onDone?.(); }, 2450);
    // Safety net so a throttled/backgrounded tab never blocks the site.
    const safety = setTimeout(() => { setVisible(false); onDone?.(); }, 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(safety); };
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="preloader"
          exit={{ y: '-100%' }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="preloader__mark" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <SlaLogo size="xl" />
            </motion.div>
          </div>

          <div className="preloader__bar">
            <motion.span
              initial={{ width: '0%' }}
              animate={{ width: phase === 'letters' ? '0%' : '100%' }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
