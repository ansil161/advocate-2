import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon from '../../../components/ui/Icon.jsx';
import { record } from '../../../data/awards.js';

import plateCases from '../../../assets/img/record-cases.webp';
import plateSuccess from '../../../assets/img/record-success.webp';
import plateYears from '../../../assets/img/record-years.webp';
import plateCombined from '../../../assets/img/record-experience.webp';

const RECORD_ICONS = ['ledger', 'target', 'clock', 'people'];
const PLATES = [plateCases, plateSuccess, plateYears, plateCombined];

gsap.registerPlugin(ScrollTrigger);

export default function RecordSection() {
  const containerRef = useRef(null);
  const leftInnerRef = useRef(null);
  const itemsRef = useRef([]);
  const platesRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      let mm = gsap.matchMedia();

      // Desktop: Pin left and crossfade plates
      mm.add("(min-width: 1024px)", () => {
        // Pin the inner container so the grid column doesn't collapse
        ScrollTrigger.create({
          trigger: leftInnerRef.current,
          start: 'top 10%', // offset from the top to clear the header
          end: 'bottom bottom',
          endTrigger: containerRef.current,
          pin: true,
          pinSpacing: false,
        });

        // Initialize the first plate as fully visible
        if (platesRef.current[0]) {
          gsap.set(platesRef.current[0], { opacity: 1, scale: 1 });
        }

        // Animate text items and tie them to plate crossfades
        itemsRef.current.forEach((item, i) => {
          if (!item) return;

          gsap.set(item, { opacity: 0.15, y: 40 });

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: item,
              start: 'top 75%',
              end: 'bottom 25%',
              scrub: true,
              onEnter: () => {
                // Crossfade to this plate
                platesRef.current.forEach((p, idx) => {
                  if (!p) return;
                  const inner = p.querySelector('.awr__plate-inner');
                  if (idx === i) {
                    gsap.to(p, { opacity: 1, duration: 0.8, overwrite: true });
                    if (inner) gsap.to(inner, { scale: 1, duration: 2, ease: "power2.out", overwrite: "auto" });
                  } else {
                    gsap.to(p, { opacity: 0, duration: 0.8, overwrite: true });
                    if (inner) gsap.to(inner, { scale: 1.05, duration: 0.8, overwrite: "auto" });
                  }
                });
              },
              onEnterBack: () => {
                // Crossfade to this plate when scrolling back up
                platesRef.current.forEach((p, idx) => {
                  if (!p) return;
                  const inner = p.querySelector('.awr__plate-inner');
                  if (idx === i) {
                    gsap.to(p, { opacity: 1, duration: 0.8, overwrite: true });
                    if (inner) gsap.to(inner, { scale: 1, duration: 2, ease: "power2.out", overwrite: "auto" });
                  } else {
                    gsap.to(p, { opacity: 0, duration: 0.8, overwrite: true });
                    if (inner) gsap.to(inner, { scale: 1.05, duration: 0.8, overwrite: "auto" });
                  }
                });
              }
            }
          });

          tl.to(item, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' })
            .to(item, { opacity: 0.15, y: -40, duration: 1, ease: 'power2.in' }, "+=0.5");
        });
      });

    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awr" id="aw-record" ref={containerRef}>
      <div className="container">
        <header className="awr__head">
          <span className="aw-label">The Record</span>
          <h2 className="awr__title">Credibility, kept as a record.</h2>
          <p className="awr__intro">
            Not a shelf of accolades — matters handled, outcomes secured, and years
            spent in court. These are the figures the firm is prepared to stand on.
          </p>
        </header>

        <div className="awr__grid">
          
          <div className="awr__left">
            <div className="awr__left-inner" ref={leftInnerRef}>
              <div className="awr__plate-container">
                {record.map((r, i) => (
                  <div 
                    className="awr__plate" 
                    key={`plate-${i}`}
                    ref={el => platesRef.current[i] = el}
                  >
                    <div className="awr__plate-inner" style={{ backgroundImage: `url(${PLATES[i]})` }} />
                    <span className="awr__plate-wash" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="awr__right">
            {record.map((r, i) => (
              <div 
                className="awr__item" 
                key={`record-${i}`}
                ref={el => itemsRef.current[i] = el}
              >
                <span className="awr__seq" aria-hidden="true">
                  <Icon name={RECORD_ICONS[i]} />
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="awr__figure">
                  {r.value.toLocaleString()}<i>{r.suffix}</i>
                </span>
                <span className="awr__hair" aria-hidden="true" />
                <span className="awr__label">{r.label}</span>
                {r.note && <span className="awr__note">{r.note}</span>}
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

// ── plate sources ─────────────────────────────────────────────────────────────
// All four are free under the Unsplash Licence (commercial use permitted,
// attribution not required — recorded here anyway so the provenance of every
// photograph on the site is traceable):
//
//   record-cases.webp      Iñaki del Olmo          unsplash.com/photos/NIJuEQw0RKg
//   record-success.webp    Tingey Injury Law Firm  unsplash.com/photos/yCdPU73kGSc
//   record-years.webp      Sebastian Schuster      unsplash.com/photos/lCkHnqTnjXw
//   record-experience.webp Michael D Beckwith      unsplash.com/photos/xf5Qn2-GaJQ
