import { useEffect, useState } from 'react';
import { scrollToHash } from '../../lib/useLenis.js';

// Fixed vertical rail of chapter numbers tracking scroll position through a long page.
// `dark` fixes the rail to the light-on-dark treatment; `darkIds` instead lets it
// follow the page — it flips to light-on-dark only while a listed section is active,
// which keeps the rail legible on pages that alternate cream and black backgrounds.
export default function ChapterSpine({ sectionIds = [], dark = false, darkIds }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!sectionIds.length) return;
    // More than one section can hold the centre band at once — most obviously
    // where sections stack, since a pinned panel keeps crossing it while the
    // next one rises over the top of it. Tracking only the newest intersection
    // would leave the rail stuck on the pinned panel for the whole stack, so
    // keep the set and take the furthest along: that is both the panel painted
    // on top there and the one being scrolled into everywhere else.
    const visible = new Set();
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        });
        let idx = -1;
        visible.forEach(id => {
          idx = Math.max(idx, sectionIds.indexOf(id));
        });
        if (idx !== -1) setActive(idx);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sectionIds]);

  if (!sectionIds.length) return null;

  const isDark = darkIds ? darkIds.includes(sectionIds[active]) : dark;

  return (
    <div className={`chapter-spine ${isDark ? 'is-dark' : ''}`}>
      {sectionIds.map((id, i) => (
        <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {i > 0 && <div className="chapter-spine__line" />}
          <button
            className={`chapter-spine__num ${i === active ? 'is-active' : ''}`}
            onClick={() => scrollToHash(`#${id}`)}
            aria-label={`Go to section ${i + 1}`}
          >
            {String(i + 1).padStart(2, '0')}
          </button>
        </div>
      ))}
    </div>
  );
}
