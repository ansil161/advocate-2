import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { resetScroll } from '../../lib/useLenis.js';

// A shutter-style curtain that sweeps on every route change, masking the content swap.
export default function PageReveal() {
  const { pathname } = useLocation();
  const [playing, setPlaying] = useState(false);
  // The route we last played for, rather than a "have I rendered yet" flag:
  // StrictMode runs effects twice on mount, which flips such a flag and makes
  // the curtain sweep on first load. Comparing paths is stable under that.
  const playedFor = useRef(pathname);

  // The reset has to land before the incoming page's own layout effects run.
  // PageReveal sits above the routes in the tree, so its layout effect fires
  // first — which is what keeps a scroll-driven page (the About hero) from
  // building its ScrollTrigger around the *outgoing* page's scroll position and
  // then visibly animating itself back to the start once the reset arrives.
  useLayoutEffect(() => {
    if (playedFor.current === pathname) return;
    resetScroll();
  }, [pathname]);

  useEffect(() => {
    if (playedFor.current === pathname) return;
    playedFor.current = pathname;
    setPlaying(true);
    const t = setTimeout(() => setPlaying(false), 900);
    return () => clearTimeout(t);
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
