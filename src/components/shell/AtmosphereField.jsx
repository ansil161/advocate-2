import { useEffect, useRef } from 'react';

// A subtle ambient layer: film grain + a slow-drifting gold glow, fixed behind all content.
export default function AtmosphereField() {
  const glowRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    let raf;
    const start = performance.now();
    function tick(t) {
      const elapsed = (t - start) / 1000;
      if (glowRef.current) {
        const x = 50 + Math.sin(elapsed * 0.05) * 22;
        const y = 30 + Math.cos(elapsed * 0.04) * 18;
        glowRef.current.style.left = `${x}%`;
        glowRef.current.style.top = `${y}%`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="atmosphere" aria-hidden="true">
      <div className="atmosphere__glow" ref={glowRef} style={{ transform: 'translate(-50%, -50%)' }} />
      <div className="atmosphere__grain" />
    </div>
  );
}
