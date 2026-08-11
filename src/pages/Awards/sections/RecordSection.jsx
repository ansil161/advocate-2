import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MQ, rise, EASE } from '../motion.js';
import { record } from '../../../data/awards.js';

// THE RECORD — the four verified figures, set as an editorial composition rather
// than a stat grid. Each figure sits on its own row of a 12-column field at a
// different indent, so the eye moves down the page the way it moves down a
// well-set annual report: number, rule, label, whitespace.
export default function RecordSection() {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.awr__head > *', { trigger: '.awr__head', stagger: 0.1 });

        gsap.utils.toArray('.awr__figure').forEach((fig) => {
          const tl = gsap.timeline({
            scrollTrigger: { trigger: fig, start: 'top 80%', once: true },
            defaults: { ease: EASE },
          });
          // The number rises out of its own baseline — a type mask, not a fading card.
          tl.from(fig.querySelector('.awr__value-inner'), { yPercent: 112, duration: 1.3 })
            .from(fig.querySelector('.awr__rule'), { scaleX: 0, duration: 1.1 }, 0.35)
            .from(fig.querySelectorAll('.awr__label, .awr__note, .awr__index'), {
              autoAlpha: 0,
              y: 18,
              duration: 0.9,
              stagger: 0.07,
            }, 0.5);
        });
      });

      mm.add(MQ.cinematic, () => {
        // Ledger rule down the left margin, inked in as the section is read.
        gsap.to('.awr__margin-fill', {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top 65%', end: 'bottom 75%', scrub: 0.8 },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awr" id="aw-record" ref={rootRef}>
      <div className="container">
        <header className="awr__head">
          <span className="aw-label">The Record</span>
          <h2 className="awr__title">Credibility, kept as a record.</h2>
          <p className="awr__intro">
            Not a shelf of accolades — matters handled, outcomes secured, and years
            spent in court. These are the figures the firm is prepared to stand on.
          </p>
        </header>

        <div className="awr__field">
          <div className="awr__margin" aria-hidden="true">
            <span className="awr__margin-fill" />
          </div>

          {record.map((r, i) => (
            <figure className={`awr__figure awr__figure--${i + 1}`} key={r.label}>
              <span className="awr__index">{String(i + 1).padStart(2, '0')}</span>
              <div className="awr__value">
                <span className="awr__value-inner">
                  {r.value.toLocaleString()}
                  <i className="awr__suffix">{r.suffix}</i>
                </span>
              </div>
              <span className="awr__rule" aria-hidden="true" />
              <figcaption>
                <span className="awr__label">{r.label}</span>
                {r.note && <span className="awr__note">{r.note}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
