import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MQ, rise, drawRule, EASE } from '../motion.js';
import { barCouncilEnrollments } from '../../../data/awards.js';

// BAR COUNCIL RECORD — the enrolment particulars presented as an archival sheet:
// ruled margin, index numbers, registration marks at the corners, entries listed
// like a roll. The archival language is typographic only — no facsimile of a
// Bar Council document is drawn, and no certificate is implied.
export default function BarCouncilRecord() {
  const rootRef = useRef(null);
  const count = String(barCouncilEnrollments.length).padStart(2, '0');

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.awb__head > *', { trigger: '.awb__head', stagger: 0.1 });
        // The sheet itself never fades as a block — only its contents arrive, so a
        // tall element is never left invisible mid-viewport.
        rise('.awb__sheet-head', { trigger: '.awb__sheet', y: 20, start: 'top 88%' });
        drawRule('.awb__sheet-rule', { trigger: '.awb__sheet', start: 'top 88%' });

        gsap.utils.toArray('.awb__entry').forEach((entry) => {
          const tl = gsap.timeline({
            scrollTrigger: { trigger: entry, start: 'top 88%', once: true },
            defaults: { ease: EASE },
          });
          tl.from(entry.querySelector('.awb__entry-line'), { scaleX: 0, duration: 1 })
            .from(entry.querySelectorAll('.awb__col'), {
              autoAlpha: 0,
              y: 22,
              duration: 0.95,
              stagger: 0.06,
            }, 0.12);
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awb" id="aw-bar" ref={rootRef}>
      <div className="container">
        <header className="awb__head">
          <span className="aw-label">Bar Council Record</span>
          <h2 className="awb__title">
            Bar Council of<br />
            <em>Telangana.</em>
          </h2>
          <p className="awb__note">
            Enrolment particulars of the firm’s advocates, as recorded with the
            Bar Council of Telangana.
          </p>
        </header>

        <div className="awb__stack">
          {/* Two offset paper layers behind the sheet — the edge of a file, not a card. */}
          <span className="awb__paper awb__paper--1" aria-hidden="true" />
          <span className="awb__paper awb__paper--2" aria-hidden="true" />

          <div className="awb__sheet">
            <span className="awb__mark awb__mark--tl" aria-hidden="true" />
            <span className="awb__mark awb__mark--tr" aria-hidden="true" />
            <span className="awb__mark awb__mark--bl" aria-hidden="true" />
            <span className="awb__mark awb__mark--br" aria-hidden="true" />

            <div className="awb__sheet-head">
              <span>Roll of Enrolment</span>
              <span>{count} entries on record</span>
            </div>
            <span className="awb__sheet-rule" aria-hidden="true" />

            <ol className="awb__list">
              {barCouncilEnrollments.map((b, i) => (
                <li className="awb__entry" key={b.enrollment}>
                  <span className="awb__entry-line" aria-hidden="true" />
                  <span className="awb__col awb__index">{String(i + 1).padStart(2, '0')}</span>
                  <div className="awb__col awb__identity">
                    <h3 className="awb__name">{b.name}</h3>
                    <span className="awb__role">{b.role}</span>
                  </div>
                  <div className="awb__col awb__enrol">
                    <span className="awb__key">Enrolment No.</span>
                    <span className="awb__val">{b.enrollment}</span>
                  </div>
                  <div className="awb__col awb__since">
                    <span className="awb__key">Since</span>
                    <span className="awb__val">{b.since}</span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
