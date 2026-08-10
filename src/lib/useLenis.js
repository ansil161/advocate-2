import { useEffect, useRef } from 'react';
import Lenis from 'lenis';

let sharedLenis = null;

// Single Lenis instance shared across the whole app (route changes don't recreate it).
export function useLenis() {
  const ref = useRef(sharedLenis);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // Only create the Lenis instance once (it's a singleton), but the raf loop
    // must restart on every mount — React 18 StrictMode mounts this effect
    // twice in dev, and a loop that only starts when sharedLenis is falsy
    // would never restart after StrictMode's mount→unmount→mount cycle,
    // leaving Lenis in control of scroll but never actually driving it.
    if (!sharedLenis) {
      sharedLenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });
    }
    const lenis = sharedLenis;
    ref.current = lenis;

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return ref;
}

export function getLenis() {
  return sharedLenis;
}

export function scrollToHash(hash) {
  if (!hash) return;
  const el = document.querySelector(hash);
  if (!el) return;
  if (sharedLenis) {
    sharedLenis.scrollTo(el, { offset: -84, duration: 1.3 });
  } else {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
