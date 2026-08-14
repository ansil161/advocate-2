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
//  Built to the reference frame by frame: one wide bar, split down the middle
//  into two equal boxes that turn as one solid.
//
//    · LEFT  — a pale slab carrying the figure, set large and repeated across
//              the face, walking sideways as the bar turns. The index, the
//              name and the note sit small in the slab's corners.
//    · RIGHT — a dark panel with the photograph laid on it well in from the
//              edge, so the tint reads as a mount rather than a border.
//
//  Both boxes carry four faces of a cube — each face pushed out by half the
//  box's own depth and turned a quarter more than the last — plus a wall
//  closing the outer end, and both are driven by one rotation, so they roll in
//  lockstep. The next figure arrives from ABOVE: the box tips its top face
//  down toward the reader, which is why the rotation runs negative.
//
//  The geometry is measured, not guessed. The bar stands 46% of the viewport
//  tall and each half is 1.2 : 1, and the camera sits 5.6 box-depths back —
//  that last figure is what decides whether the turn reads as a block going
//  over end for end or as two flat cards flipping. The working is in the
//  camera note in Awards.css.
//
//  One departure from the reference, deliberate: it lets its wordmark run off
//  both ends of the slab, because a wordmark stays legible cropped. A figure
//  does not — "2,00" is not a number — so the type size, the gap between
//  copies and the length of the walk are tuned together so that the centre
//  figure is never cut while the copies beside it still come into frame.
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
        // Read off the reference by tracking its scrollbar against the angle of
        // the solid, frame by frame. A quarter turn there costs 7.2 thumb-pixels
        // of scroll and the whole figure-to-figure cycle costs 9.5 — so roughly
        // three quarters of the scroll is spent turning and one quarter holding
        // the face flat. Both of its turns cost the same 7.2 despite being
        // scrolled at very different speeds, which is what proves the rotation
        // is scrubbed to scroll position rather than played on a timer.
        //
        // The first build held for as long as it turned. That is twice the
        // dwell the reference has, and it makes the bar feel like a slideshow
        // waiting for you rather than a solid you are rolling.
        const HOLD = 0.32;
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
          // power2, not power3. The reference's own curve cannot be recovered
          // from the clip — its rotation visibly trails the scroll and is still
          // catching up half a second after the wheel stops, and that lag masks
          // the easing underneath it. What the clip does settle is the dwell
          // above, and against a dwell that short a harder ease would put back
          // the same waiting that the dwell was just cut to remove.
          tl.to('.awr__solid', { rotateX: -i * 90, duration: 1, ease: 'power2.inOut' }, at)
            .to({}, { duration: HOLD });
        }

        // The marquee's sideways walk. The row is stretched across the slab, so
        // xPercent is read against the slab's own width: 8.3 either way carries
        // the type a sixth of the slab across the whole run. That is far enough
        // for the copy on each side to be caught by the edge — the point of
        // repeating it — and never far enough to cut the centre figure, which
        // is set to clear its own half-width plus the walk. See the gap and
        // font-size in Awards.css; the three numbers are tuned as one.
        gsap.fromTo('.awr__figure-row', { xPercent: 8.3 }, {
          xPercent: -8.3,
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
                    {/* Three copies, and only the middle one is the figure as
                        far as anything reading the page is concerned — the two
                        that flank it exist to be caught by the slab's edge as
                        the row walks, and are hidden so the number is not
                        announced three times. */}
                    <span className="awr__figure-row">
                      {[-1, 0, 1].map(k => (
                        <span className="awr__figure" key={k} aria-hidden={k !== 0 ? 'true' : undefined}>
                          {r.value.toLocaleString()}<i>{r.suffix}</i>
                        </span>
                      ))}
                    </span>
                    <figcaption>
                      <span className="awr__label">{r.label}</span>
                      {r.note && <span className="awr__note">{r.note}</span>}
                    </figcaption>
                  </figure>
                ))}
                <span className="awr__wall" aria-hidden="true" />
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
                <span className="awr__wall" aria-hidden="true" />
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
