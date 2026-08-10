import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// A shutter-style curtain that sweeps on every route change, masking the content swap.
export default function PageReveal() {
  const { pathname } = useLocation();
  const [playing, setPlaying] = useState(false);
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    if (firstRender) { setFirstRender(false); return; }
    setPlaying(true);
    window.scrollTo(0, 0);
    const t = setTimeout(() => setPlaying(false), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {playing && (
        <motion.div
          className="page-reveal"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: [0, 1, 1, 0] }}
          exit={{ scaleY: 0 }}
          transition={{ duration: 0.9, times: [0, 0.45, 0.55, 1], ease: [0.76, 0, 0.24, 1] }}
          style={{ transformOrigin: 'bottom' }}
        />
      )}
    </AnimatePresence>
  );
}
