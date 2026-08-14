import { useEffect, useRef } from 'react';

export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const cursorRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;

    // Only now is the system cursor given up — see the note on `.has-cursor`
    // in index.css. Before this line runs the visitor still has a real pointer.
    document.documentElement.classList.add('has-cursor');

    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const ringPos = { ...pos };
    let raf;

    // The dot is moved by the pointer event itself, not by the frame loop. A
    // scroll-driven page can starve rAF for whole frames at a time, and a dot
    // that lags the real pointer reads as the cursor having disappeared — the
    // one thing a site that hides the system cursor cannot afford. Only the
    // ring, which is meant to trail, waits for a frame.
    function onMove(e) {
      pos.x = e.clientX;
      pos.y = e.clientY;
      if (dotRef.current) dotRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    }
    window.addEventListener('mousemove', onMove, { passive: true });

    function tick() {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      if (ringRef.current) ringRef.current.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function onEnter() { cursorRef.current?.classList.add('is-active'); }
    function onLeave() { cursorRef.current?.classList.remove('is-active'); }

    function attach() {
      document.querySelectorAll('a, button, .magnetic').forEach(el => {
        el.addEventListener('mouseenter', onEnter);
        el.addEventListener('mouseleave', onLeave);
      });
    }
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.documentElement.classList.remove('has-cursor');
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="cursor" ref={cursorRef} aria-hidden="true">
      <div className="cursor__dot" ref={dotRef}></div>
      <div className="cursor__ring" ref={ringRef}></div>
    </div>
  );
}
