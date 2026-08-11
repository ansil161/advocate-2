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
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = sectionIds.indexOf(entry.target.id);
            if (idx !== -1) setActive(idx);
          }
        });
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
