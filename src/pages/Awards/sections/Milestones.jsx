import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { MQ, rise, settle, EASE } from '../motion.js';
import { milestones } from '../../../data/awards.js';

// MILESTONES — an archive, not a dotted timeline. Huge years, small entries, and
// a ruled break between each; the years alternate their indent so the column of
// dates reads as a sequence of filed pages rather than a ladder.
export default function Milestones() {
  const rootRef = useRef(null);
  const total = String(milestones.length).padStart(2, '0');

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.awm__head > *', { trigger: '.awm__head', stagger: 0.1 });

        gsap.utils.toArray('.awm__entry').forEach((entry) => {
          gsap.from(entry.querySelector('.awm__entry-rule'), {
            scaleX: 0,
            duration: 1.2,
            ease: EASE,
            scrollTrigger: { trigger: entry, start: 'top 86%', once: true },
          });
          settle(entry.querySelector('.awm__year'), { trigger: entry, start: 'top 78%' });
          rise(entry.querySelectorAll('.awm__index, .awm__entry-title, .awm__entry-body'), {
            trigger: entry,
            start: 'top 78%',
            y: 26,
            stagger: 0.07,
            delay: 0.15,
          });
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="awm" id="aw-milestones" ref={rootRef}>
      <div className="container">
        <header className="awm__head">
          <span className="aw-label aw-label--light">Milestones</span>
          <h2 className="awm__title">
            1996 — <em>Today.</em>
          </h2>
          <p className="awm__note">Thirty years of practice, entered in sequence.</p>
        </header>

        <ol className="awm__list">
          {milestones.map((m, i) => (
            <li className={`awm__entry awm__entry--${i % 2 === 0 ? 'a' : 'b'}`} key={m.year}>
              <span className="awm__entry-rule" aria-hidden="true" />
              <span className="awm__index">
                {String(i + 1).padStart(2, '0')} / {total}
              </span>
              {/* Ranged years ("2012–2015") are set smaller so no entry can
                  overflow its column at the largest display sizes. */}
              <span className={`awm__year${m.year.length > 5 ? ' awm__year--long' : ''}`}>{m.year}</span>
              <div className="awm__entry-text">
                <h3 className="awm__entry-title">{m.title}</h3>
                <p className="awm__entry-body">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
