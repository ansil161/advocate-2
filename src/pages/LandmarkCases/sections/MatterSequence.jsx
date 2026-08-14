import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon, { practiceIcon } from '../../../components/ui/Icon.jsx';
import { getPracticeBySlug } from '../../../data/practiceAreas.js';
import imgBanking from '../../../assets/img/bench-table.webp';
import imgCivil from '../../../assets/img/bench-corridor.webp';
import imgWrit from '../../../assets/img/columns-abstract.webp';
import imgCriminal from '../../../assets/img/bench-chambers.webp';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  THE DECK — one matter at a time
// ------------------------------------------------------------
//  The four matters are not four screens you scroll past; they are four states
//  of ONE screen. The stage sticks to the viewport and the scroll drives a
//  single scrubbed timeline that hands the stage from one matter to the next:
//
//    · the outgoing plate settles back and dims while its copy lifts away,
//      blurring, in reverse reading order;
//    · the incoming plate is uncovered by a clip walked open from the bottom
//      edge — the photograph is laid down, not faded in — with the picture
//      oversized behind it so the frame and the image travel at different
//      speeds;
//    · the copy then rises in reading order, out of blur: category, title,
//      account, forum and outcome;
//    · the plate changes sides on every matter, so the composition swings
//      across the screen rather than pulsing in place;
//    · a rail down the left counts 01 → 04 and fills as the deck advances.
//
//  Every value above is scrubbed against scroll — nothing plays on a clock, so
//  the sequence reads as one continuous move under the reader's own hand
//  (Lenis smooths the wheel; ScrollTrigger is synced to it in lib/useLenis).
//
//  Under 900px, or with reduced motion, none of it runs: `.mtr` collapses to
//  its natural height, the layers stack in normal flow, each panel reveals
//  once on entry, and the rail is dropped.
// ============================================================

// Presentation, so it lives here and not in the content file.
const PLATE = {
  'banking-financial-laws': imgBanking,
  'civil-litigation': imgCivil,
  'constitutional-writ-practice': imgWrit,
  'criminal-law': imgCriminal,
};

const CINEMATIC = '(min-width: 901px) and (prefers-reduced-motion: no-preference)';
const STATIC = '(max-width: 900px), (prefers-reduced-motion: reduce)';

export default function MatterSequence({ cases }) {
  const rootRef = useRef(null);
  const [active, setActive] = useState(0);
  const total = cases.length;

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ── the deck ─────────────────────────────────────────────
      mm.add(CINEMATIC, () => {
        const layers = gsap.utils.toArray('.mtr__layer');
        const part = layer => ({
          frame: layer.querySelector('.mtr__frame'),
          img: layer.querySelector('.mtr__img'),
          numeral: layer.querySelector('.mtr__numeral'),
          rise: layer.querySelectorAll('.mtr__rise'),
          // Which way the copy drifts as it leaves, so the exit follows the
          // side the composition is about to swing away from.
          dir: layer.classList.contains('mtr__panel--flip') ? 1 : -1,
        });

        // Everything after the first matter starts closed. Set here rather
        // than in CSS so the deck is readable before GSAP runs and for anyone
        // it never runs for — and reverted automatically when the query stops
        // matching, which is what returns the stack to normal flow.
        layers.forEach((layer, i) => {
          if (i === 0) return;
          const p = part(layer);
          gsap.set(layer, { autoAlpha: 0 });
          gsap.set(p.frame, { clipPath: 'inset(100% 0% 0% 0%)' });
          gsap.set(p.rise, { autoAlpha: 0, y: 46, filter: 'blur(6px)' });
          gsap.set(p.numeral, { autoAlpha: 0, y: 44 });
        });

        // One timeline for the whole run: `hold` is the time each matter owns
        // the stage alone, `pass` the time the hand-off takes. They are
        // timeline units, not seconds — scrub maps them onto the scroll.
        const HOLD = 0.85;
        const marks = [0];

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });

        tl.to({}, { duration: HOLD });

        layers.forEach((layer, i) => {
          if (i === 0) return;
          const out = part(layers[i - 1]);
          const inn = part(layer);
          const at = tl.duration();
          marks.push(at + 0.45);

          // Leaving: the copy goes first and the plate follows it out, so the
          // reader is released from the words before the picture is taken.
          tl.to(out.rise, {
            autoAlpha: 0,
            y: -30,
            x: 18 * out.dir,
            filter: 'blur(6px)',
            duration: 0.5,
            stagger: { each: 0.05, from: 'end' },
            ease: 'power1.in',
          }, at)
            .to(out.numeral, { autoAlpha: 0, y: -34, duration: 0.5 }, at)
            .to(out.frame, { scale: 0.94, autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, at)
            .set(layers[i - 1], { autoAlpha: 0 }, at + 0.7)

            // Arriving: the plate is uncovered bottom-to-top behind an
            // oversized picture, then the copy rises out of blur.
            .set(layer, { autoAlpha: 1 }, at)
            .fromTo(inn.frame,
              { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.02 },
              { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1, ease: 'power3.out' }, at + 0.2)
            .fromTo(inn.img,
              { scale: 1.22, yPercent: -7 },
              { scale: 1.04, yPercent: 0, duration: 1.5, ease: 'power2.out' }, at + 0.2)
            .to(inn.numeral, { autoAlpha: 0.82, y: 0, duration: 0.8, ease: 'power2.out' }, at + 0.45)
            .to(inn.rise, {
              autoAlpha: 1,
              y: 0,
              x: 0,
              filter: 'blur(0px)',
              duration: 0.8,
              stagger: 0.08,
              ease: 'power2.out',
            }, at + 0.5)
            .to({}, { duration: HOLD });
        });

        // The first matter has no hand-off to arrive on, so it is laid down
        // against the stage's own approach: the reveal is scrubbed over the
        // window between the section entering the screen and locking to the
        // top, which means matter 01 is complete at the exact moment the deck
        // takes the viewport — never a blank stage, never a late reveal.
        const first = part(layers[0]);
        const entry = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top 88%',
            end: 'top 18%',
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        entry
          .fromTo(first.frame,
            { clipPath: 'inset(100% 0% 0% 0%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power3.out' }, 0)
          .fromTo(first.img,
            { scale: 1.22, yPercent: -7 },
            { scale: 1.04, yPercent: 0, duration: 1.5, ease: 'power2.out' }, 0)
          .from(first.numeral, { autoAlpha: 0, y: 44, duration: 0.7, ease: 'power2.out' }, 0.35)
          .from(first.rise, {
            autoAlpha: 0,
            y: 46,
            filter: 'blur(6px)',
            duration: 0.7,
            stagger: 0.07,
            ease: 'power2.out',
          }, 0.4);

        // The rail fills across the whole run.
        gsap.fromTo('.mtr__rail-fill', { scaleY: 0 }, {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: { trigger: rootRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
        });

        // The rail's mark follows the timeline, not the raw scroll: the deck's
        // holds mean scroll distance and matter index are not proportional.
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

      // ── the stack (no pin, no scrub) ─────────────────────────
      mm.add(STATIC, () => {
        gsap.utils.toArray('.mtr__layer').forEach(panel => {
          gsap.from(panel.querySelectorAll('.mtr__rise'), {
            autoAlpha: 0,
            y: 28,
            duration: 0.9,
            stagger: 0.07,
            ease: 'power2.out',
            scrollTrigger: { trigger: panel, start: 'top 78%', once: true },
          });
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, [total]);

  return (
    <div className="mtr" ref={rootRef} style={{ '--mtr-count': total }}>
      <div className="mtr__stage">
        {/* The rail. Decorative — the numbers it counts are set on the panels
            themselves, so nothing here is the only copy of anything. */}
        <div className="mtr__rail" aria-hidden="true">
          <span className="mtr__rail-track"><i className="mtr__rail-fill" /></span>
          <span className="mtr__rail-ticks">
            {cases.map((item, i) => (
              <span key={item.title} className={`mtr__tick ${i === active ? 'is-active' : ''}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
            ))}
          </span>
        </div>

        <div className="mtr__deck">
          {cases.map((c, i) => {
            const practice = getPracticeBySlug(c.practiceSlug);
            return (
              <article
                className={`mtr__panel mtr__layer ${i % 2 ? 'mtr__panel--flip' : ''}`}
                key={c.title}
                aria-labelledby={`mtr-t-${i}`}
              >
                <div className="mtr__figure">
                  <div className="mtr__frame">
                    <img
                      className="mtr__img"
                      src={PLATE[c.practiceSlug]}
                      alt=""
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                    />
                    <span className="mtr__wash" />
                  </div>
                  {/* Set across the frame's edge, half on the picture and half
                      off it — the one place the deck lets two layers touch. */}
                  <span className="mtr__numeral">{String(i + 1).padStart(2, '0')}</span>
                </div>

                <div className="mtr__body">
                  <span className="mtr__cat mtr__rise">
                    <Icon name={practiceIcon(c.practiceSlug)} />
                    {c.category}
                  </span>

                  <h3 className="mtr__title mtr__rise" id={`mtr-t-${i}`}>{c.title}</h3>

                  <p className="mtr__account mtr__rise">{c.summary}</p>

                  <dl className="mtr__data mtr__rise">
                    <div>
                      <dt>Forum</dt>
                      <dd>{c.forum}</dd>
                    </div>
                    <div className="mtr__data-outcome">
                      <dt>Outcome</dt>
                      <dd>{c.outcome}</dd>
                    </div>
                  </dl>

                  <p className="mtr__withheld mtr__rise">
                    <i aria-hidden="true" />
                    Particulars withheld — client confidentiality
                  </p>

                  {practice && (
                    <div className="mtr__rise">
                      <Link to={`/practice/${practice.slug}`} className="link-arrow link-arrow--light">
                        <span>{practice.title}</span> →
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
