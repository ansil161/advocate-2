import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import Icon from '../../../components/ui/Icon.jsx';
import { MQ, rise, EASE } from '../motion.js';
import { record } from '../../../data/awards.js';
// One plate per figure. All four are Unsplash-licence photographs (free for
// commercial use, no attribution required) — see the note at the foot of this
// file for source and photographer.
import plateCases from '../../../assets/img/record-cases.webp';
import plateSuccess from '../../../assets/img/record-success.webp';
import plateYears from '../../../assets/img/record-years.webp';
import plateCombined from '../../../assets/img/record-experience.webp';

// One mark per figure, in the order `record` is built in data/awards.js:
// cases handled · success rate · years at the bar · combined experience.
const RECORD_ICONS = ['ledger', 'target', 'clock', 'people'];
const PLATES = [plateCases, plateSuccess, plateYears, plateCombined];

// The solid's own breakpoint, NOT the page's `MQ.cinematic` (861px): the 3D is
// built in CSS at 901px, and a rotation running against a stage that is still
// in normal flow would turn four blocks of the page. The two must match.
const SOLID = '(min-width: 901px) and (prefers-reduced-motion: no-preference)';
const FLAT = '(max-width: 900px), (prefers-reduced-motion: reduce)';

// ============================================================
//  THE RECORD — two solids, rolled together
// ------------------------------------------------------------
//  Built to the reference: one wide bar split into two boxes that turn as one.
//
//    · LEFT  — a pale slab carrying the figure itself, set huge and repeated
//              across the face, drifting sideways as the bar turns.
//    · RIGHT — a tinted panel holding an inset card: the photograph, the label
//              and the note. Half a step taller than the slab and nudged up,
//              so it breaks the bar's line exactly as it does in the reference.
//
//  Both boxes carry four faces of a cube — each face pushed out by half the
//  box's own depth and turned a quarter more than the last — and both are
//  driven by one rotation, so they roll in lockstep. The next figure arrives
//  from ABOVE: the box tips its top face down toward the reader, which is why
//  the rotation runs negative.
//
//  Because the two boxes sit at slightly different heights against a single
//  perspective origin, the turn shows the underside of one and the top of the
//  other at the same moment — the detail that makes the pair read as two solid
//  objects in one space rather than two rotating rectangles.
//
//  The stage sticks to the viewport for the length of the run, the turn is
//  scrubbed against scroll, and each figure holds the front before the next
//  comes down. Below 900px, or with reduced motion, no solid is built: the
//  faces are four plain blocks down the page.
// ============================================================
export default function RecordSection() {
  const rootRef = useRef(null);
  // The track, NOT the section: the section also carries the head, so its top
  // is not where the stage locks. Every trigger below is measured against the
  // track, whose height IS the sticky range — start/end and pin then agree.
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const total = record.length;

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(MQ.motion, () => {
        rise('.awr__head > *', { trigger: '.awr__head', stagger: 0.1 });
      });

      mm.add(SOLID, () => {
        const HOLD = 0.85;
        const marks = [0];

        // Nothing fades. Every face carries its card at full strength the whole
        // time, so the figure arriving from above is already legible on the top
        // of the solid as it comes down — as it is in the reference. Fading the
        // incoming card in after the turn lands leaves the top face reading as
        // an empty lid for the length of the roll.

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: trackRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });

        tl.to({}, { duration: HOLD });

        for (let i = 1; i < total; i++) {
          const at = tl.duration();
          marks.push(at + 0.55);

          // The quarter-turn. Negative, so the top face comes down to the
          // front. Both boxes take the same value on the same tween — that is
          // what keeps the pair reading as one object.
          tl.to('.awr__solid', { rotateX: -i * 90, duration: 1.1, ease: 'power2.inOut' }, at)
            .to({}, { duration: HOLD });
        }

        // A long, slow sideways drift on the figures — the reference's walking
        // wordmark, kept as a whisper. Six percent of the slab over the whole
        // run: enough to feel, never enough to crop a digit.
        gsap.fromTo('.awr__face--type figcaption, .awr__figure', { xPercent: 2.5 }, {
          xPercent: -2.5,
          ease: 'none',
          scrollTrigger: { trigger: trackRef.current, start: 'top top', end: 'bottom bottom', scrub: 1 },
        });

        gsap.fromTo('.awr__progress-fill', { scaleX: 0 }, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: trackRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
        });

        // The index follows the timeline, not the raw scroll: the holds mean
        // scroll distance and figure number are not proportional.
        let current = 0;
        tl.eventCallback('onUpdate', () => {
          const t = tl.time();
          let i = 0;
          while (i + 1 < marks.length && t >= marks[i + 1]) i++;
          if (i !== current) {
            current = i;
            setActive(i);
          }
        });
      });

      // ── taken apart (no pin, no perspective) ─────────────────
      mm.add(FLAT, () => {
        gsap.utils.toArray('.awr__pair').forEach(pair => {
          gsap.from(pair.querySelectorAll('.awr__rise'), {
            autoAlpha: 0, y: 24, duration: 0.9, stagger: 0.07, ease: EASE,
            scrollTrigger: { trigger: pair, start: 'top 82%', once: true },
          });
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [total]);

  return (
    <section className="awr" id="aw-record" ref={rootRef} style={{ '--awr-count': total }}>
      <div className="container">
        <header className="awr__head">
          <span className="aw-label">The Record</span>
          <h2 className="awr__title">Credibility, kept as a record.</h2>
          <p className="awr__intro">
            Not a shelf of accolades — matters handled, outcomes secured, and years
            spent in court. These are the figures the firm is prepared to stand on.
          </p>
        </header>
      </div>

      <div className="awr__track" ref={trackRef}>
        <div className="awr__stage">
        <div className="container awr__frame">
          <div className="awr__meta" aria-hidden="true">
            <span>Verified Figures</span>
            <span className="awr__count">
              <b>{String(active + 1).padStart(2, '0')}</b> / {String(total).padStart(2, '0')}
            </span>
          </div>

          <div className="awr__scene">
            {/* ── left: the figure and what it is ── */}
            <div className="awr__box awr__box--type">
              <div className="awr__solid">
                {record.map((r, i) => (
                  <figure className="awr__face awr__face--type" key={r.label} style={{ '--i': i }}>
                    <span className="awr__seq" aria-hidden="true">
                      <Icon name={RECORD_ICONS[i]} />
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="awr__figure">
                      {r.value.toLocaleString()}<i>{r.suffix}</i>
                    </span>
                    <span className="awr__hair" aria-hidden="true" />
                    <figcaption>
                      <span className="awr__label">{r.label}</span>
                      {r.note && <span className="awr__note">{r.note}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            {/* ── right: the plate, a step taller ── */}
            <div className="awr__box awr__box--plate">
              <div className="awr__solid">
                {record.map((r, i) => (
                  <div className="awr__face awr__face--plate" key={r.label} style={{ '--i': i }} aria-hidden="true">
                    {/* The photograph is a background, not an <img>, and that is
                        not a stylistic choice: Chrome refuses to paint an <img>
                        inside a rotating 3D face, so the plates went black the
                        moment the solid moved. A background image on the same
                        box paints correctly at every angle. These plates are
                        decorative (alt="" either way) and the flat layout below
                        still uses real <img> elements, pointing at the same four
                        files, so nothing is downloaded twice. */}
                    <div className="awr__plate">
                      <div className="awr__plate-inner" style={{ backgroundImage: `url(${PLATES[i]})` }} />
                      <span className="awr__plate-wash" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="awr__foot" aria-hidden="true">
            <span className="awr__ticks">
              {record.map((r, i) => (
                <span key={r.label} className={`awr__tick ${i === active ? 'is-active' : ''}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              ))}
            </span>
            <span className="awr__progress"><i className="awr__progress-fill" /></span>
          </div>
        </div>
        </div>
      </div>

      {/* Flat layout only — the same four figures as plain blocks, used below
          900px and under reduced motion, where no solid is built. */}
      <div className="container awr__flat">
        {record.map((r, i) => (
          <div className="awr__pair" key={r.label}>
            <div className="awr__flat-media awr__rise">
              <img src={PLATES[i]} alt="" loading="lazy" decoding="async" />
              <span className="awr__plate-wash" aria-hidden="true" />
            </div>
            <div className="awr__flat-copy">
              <span className="awr__seq awr__rise" aria-hidden="true">
                <Icon name={RECORD_ICONS[i]} />
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="awr__figure awr__rise">
                {r.value.toLocaleString()}<i>{r.suffix}</i>
              </span>
              <span className="awr__hair awr__rise" aria-hidden="true" />
              <span className="awr__label awr__rise">{r.label}</span>
              {r.note && <span className="awr__note awr__rise">{r.note}</span>}
            </div>
          </div>
        ))}
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
