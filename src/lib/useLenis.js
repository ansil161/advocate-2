import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
// Required, not cosmetic. It carries `html.lenis, html.lenis body { height: auto }`,
// which undoes the `html, body { height: 100% }` in the reset. Without it Lenis
// measures the content as one viewport tall, so its scroll limit computes to 0 and
// it silently stops driving the page — native scrolling still works, so the failure
// is invisible, but every scrubbed ScrollTrigger loses its smoothed input.
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

let sharedLenis = null;

// Single Lenis instance shared across the whole app (route changes don't recreate it).
// Driven by gsap.ticker (instead of a raw rAF loop) and wired to ScrollTrigger.update
// so GSAP's pinned/scrubbed timelines (e.g. the About page's cinematic Story section)
// stay in perfect sync with Lenis's smoothed scroll position — see gsap.com/resources/Lenis.
export function useLenis() {
  const ref = useRef(sharedLenis);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    // Only create the Lenis instance once (it's a singleton), but the ticker
    // callback must restart on every mount — React 18 StrictMode mounts this effect
    // twice in dev, and a loop that only starts when sharedLenis is falsy
    // would never restart after StrictMode's mount→unmount→mount cycle,
    // leaving Lenis in control of scroll but never actually driving it.
    if (!sharedLenis) {
      sharedLenis = new Lenis({ duration: 1.1, smoothWheel: true, syncTouch: false });
      sharedLenis.on('scroll', ScrollTrigger.update);
      // Dev-only handle: scroll-driven sequences can't be inspected by setting
      // window.scrollY (Lenis owns the position and would snap back on the next
      // frame), so expose the instance for stepping through a timeline by hand.
      if (import.meta.env.DEV) window.__lenis = sharedLenis;
    }
    const lenis = sharedLenis;
    ref.current = lenis;

    const onTick = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(onTick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(onTick);
    };
  }, []);

  return ref;
}

export function getLenis() {
  return sharedLenis;
}

// Send the page to the top *through* Lenis, synchronously.
//
// A bare window.scrollTo(0, 0) does not survive here: Lenis owns the scroll
// position and writes its own value back on the next frame, so the reset is
// undone before it is ever seen. Route changes must use this instead — and must
// use it in a layout effect, because a scroll-driven page mounting underneath
// will read the scroll position in its own layout effect and build its
// ScrollTriggers around whatever it finds there.
export function resetScroll() {
  if (sharedLenis) sharedLenis.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
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
