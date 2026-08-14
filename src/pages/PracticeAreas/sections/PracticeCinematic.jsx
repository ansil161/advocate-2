import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon from '../../../components/ui/Icon.jsx';
import { chamberImage } from '../lib/practiceImagery.js';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  PRACTICE DETAIL — THE MATTER · THE APPROACH · THE CHAMBER
// ------------------------------------------------------------
//  One sticky stage, one master timeline, one camera move. The three chapters
//  are not three sections that happen to follow each other — they are three
//  distances along a single dolly, and the same object is in frame throughout.
//
//  The object is the case file.
//
//    THE MATTER    the file is closed and far off; the camera closes on it
//    ——            the cover lifts, the leaves come apart
//    THE APPROACH  each leaf stands up into a bay — the file becomes a colonnade,
//    ——            the camera keeps going and passes between the bays
//    THE CHAMBER   the columns clear frame and the institution resolves behind them
//
//  Nothing cuts. Every chapter starts leaving before the next has arrived, and
//  the photograph, the file's depth and the drawing are all still moving while
//  the typography changes over. All copy comes from data/practiceAreas.js —
//  this component is a camera, not a content store.
//
//  Positions on the 0→1 master timeline:
// ============================================================
const CUE = {
  fileIn: 0.02, // the closed file is already approaching when the chapter opens
  matter: 0.08, // 01 — THE MATTER
  matterOut: 0.27,
  split: 0.28, // the cover lifts; the leaves separate
  bays: 0.34, // leaves stand up into a colonnade of bays
  approach: 0.33, // 02 — THE APPROACH
  heads: 0.4, // the practice's heads of work run up the bays
  approachOut: 0.6,
  through: 0.62, // the camera passes between the bays
  chamber: 0.66, // 03 — THE CHAMBER
  forums: 0.71, // the institutions name themselves, one at a time
  daylight: 0.95, // the stage hands off to Lead Counsel
};

// The two states the photograph is graded between. The gap is what makes the
// arrival legible: the latent plate has to read as darkness with a building in
// it, not as a dimmed photograph.
const PHOTO_LATENT = 'grayscale(1) brightness(0.3) contrast(1.02)';
const PHOTO_FINAL = 'grayscale(1) brightness(1.16) contrast(1.06)';

// The chapter titles are deliberately editorial, and on their own they are a
// riddle: a first-time visitor should not have to infer what "The Chamber" is
// from a photograph of a colonnade. Each chapter carries a one-line gloss under
// its title saying, in plain words, what the reader is being told.
const DECK = {
  matter: 'What this practice covers',
  approach: 'How we run a matter',
  chamber: 'Where the matter is heard',
};

// Five bays is the widest colonnade that still holds its rhythm on a laptop;
// practices carrying more heads of work simply show their first five.
const MAX_BAYS = 5;

// How narrow a leaf of the brief gets when it stands up — narrow enough to read
// as a structural member rather than a sheet of paper on its end. Its height is
// not a constant: `geom()` measures it against whatever the frame has spare.
const BAY_WIDTH = 0.44;

export default function PracticeCinematic({ practice }) {
  const trackRef = useRef(null);
  const el = useRef({});
  const plates = useRef([]);
  const rules = useRef([]);
  const heads = useRef([]);
  const forumNames = useRef([]);
  const forumIndex = useRef([]);

  const bayTags = practice.tags.slice(0, MAX_BAYS);
  const forums = practice.forums;
  const photo = chamberImage(practice.slug);

  // Ref arrays are rebuilt every render rather than mutated in place: a practice
  // with fewer heads of work than the last one must not inherit its leaves.
  plates.current.length = 0;
  rules.current.length = 0;
  heads.current.length = 0;
  forumNames.current.length = 0;
  forumIndex.current.length = 0;

  useLayoutEffect(() => {
    plates.current = plates.current.filter(Boolean);
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          cinematic: '(min-width: 861px) and (prefers-reduced-motion: no-preference)',
          compact: '(max-width: 860px) and (prefers-reduced-motion: no-preference)',
          still: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { cinematic, compact } = context.conditions;
          if (cinematic || compact) return build(!!cinematic);
          return buildStill();
        }
      );

      // --------------------------------------------------------
      //  Reduced motion — the sequence collapses to its last frame plus three
      //  editorial blocks. The scroll track is flattened in CSS, so there is no
      //  empty page left behind where the camera move used to be.
      // --------------------------------------------------------
      function buildStill() {
        const r = el.current;
        gsap.set([r.file, r.datum, r.margin], { autoAlpha: 0 });
        gsap.set(r.chamber, { autoAlpha: 1, scale: 1 });
        gsap.set(r.focus, { filter: 'blur(0px)' });
        gsap.set(r.photo, { filter: PHOTO_FINAL });
        gsap.set([r.mType, r.aType, r.cType], { opacity: 1, y: 0, pointerEvents: 'auto' });
        gsap.set([...heads.current, ...forumNames.current, ...forumIndex.current].filter(Boolean), {
          autoAlpha: 1,
          y: 0,
          x: 0,
        });
      }

      // --------------------------------------------------------
      //  The take.
      // --------------------------------------------------------
      function build(isCinematic) {
        const r = el.current;
        // On a phone the file is a single closed brief and the colonnade never
        // assembles: the beat is carried by the photograph and the typography.
        // Everything else is stripped rather than shrunk.
        const leaves = isCinematic ? plates.current.slice(1).filter(Boolean) : [];
        const cover = plates.current[0];
        const rulesEls = isCinematic ? rules.current.filter(Boolean) : [];
        // No colonnade on a phone means no bays to label. The heads of work are
        // still read there — from the list inside the Approach chapter, which is
        // the same list screen readers get on every viewport.
        const headEls = isCinematic ? heads.current.filter(Boolean) : [];

        // The colonnade is measured against the stage, never assumed. Its rhythm
        // is the widest that still fits the frame, and its height is whatever is
        // left between the sheet furniture at the top and the chapter title at
        // the bottom — so a column never runs through the typography, on any
        // viewport. Every value below is read through a function so that
        // `invalidateOnRefresh` re-measures it after a resize.
        const geom = () => {
          const stageH = r.stage?.offsetHeight || window.innerHeight;
          const stageW = r.stage?.offsetWidth || window.innerWidth;
          const plateW = cover?.offsetWidth || 180;
          const plateH = cover?.offsetHeight || 240;
          const n = Math.max(leaves.length, 1);

          const step = Math.min((stageW * 0.88) / n, plateW * 1.72);
          const top = stageH * 0.17; // clear of the nav and the margin notes
          const bottom = stageH - (r.type?.offsetHeight || stageH * 0.52) - stageH * 0.015;
          // The floor keeps a bay reading as a structural member on a short
          // viewport where the band alone would leave a stub. It stays under 1
          // on purpose: the file is still travelling towards the lens through
          // this whole chapter, so the colonnade grows past this on its own.
          const height = Math.max(plateH * 0.95, bottom - top);
          const middle = (top + bottom) / 2;
          // Where an untransformed plate sits: `inset: 0 0 12% 0; margin: auto`.
          const rest = (stageH * 0.88) / 2;

          return { step, plateH, scaleY: height / plateH, y: middle - rest, base: middle + height / 2, rest };
        };
        const bayX = (i) => (i - (leaves.length - 1) / 2) * geom().step;
        // Labels ride at the foot of their bay, in the file's 3D space but
        // outside the plate, so the column's 0.44 × N scale never touches them.
        // A long head of work ("Cheque Bounce · S.138") sets vertically longer
        // than a short one, so each label is scaled to whatever its own bay can
        // hold rather than being clipped at the top of the frame.
        const labelFit = (target) => {
          const g = geom();
          return Math.min(1, (g.scaleY * g.plateH - 44) / (target?.offsetHeight || 90));
        };
        const labelY = (i, target) => {
          const g = geom();
          return g.base - 20 - ((target?.offsetHeight || 90) * labelFit(target)) / 2 - g.rest;
        };

        // ---- opening frame: black, and a file a long way off ----
        gsap.set(r.chamber, { autoAlpha: 0.16, scale: isCinematic ? 1.36 : 1.22 });
        gsap.set(r.focus, { filter: isCinematic ? 'blur(16px)' : 'blur(8px)' });
        gsap.set(r.photo, { filter: PHOTO_LATENT });
        gsap.set(r.file, { z: isCinematic ? -520 : -260 });
        gsap.set(r.datum, { scaleX: 0, autoAlpha: 0 });
        gsap.set(r.daylight, { yPercent: 100 });
        gsap.set(r.margin, { autoAlpha: 0 });
        gsap.set([r.markMatter, r.markApproach, r.markChamber], { autoAlpha: 0 });

        gsap.set(cover, { autoAlpha: 0, y: 22, rotationX: 14, rotationY: -16, rotationZ: -4, scale: 0.94 });
        leaves.forEach((leaf, i) => {
          gsap.set(leaf, {
            autoAlpha: 0,
            x: 0,
            y: 8 + i * 7,
            z: -18 - i * 16,
            rotationX: 12,
            rotationY: -16,
            rotationZ: -4 + i * 1.1,
            scaleX: 1,
            scaleY: 1,
          });
        });
        gsap.set(headEls, { autoAlpha: 0 });

        // `opacity`, deliberately not `autoAlpha`. autoAlpha writes
        // `visibility: hidden` at zero, which takes the chapter out of the
        // accessibility tree and out of in-page find — and since only one
        // chapter is ever on screen, the other two (and the heads-of-work list
        // inside the Approach) would be unreachable at every scroll position.
        // At the top of the page all three would be hidden and this section
        // would have no readable text at all.
        gsap.set([r.mType, r.aType, r.cType], { opacity: 0, pointerEvents: 'none' });
        gsap.set(forumNames.current, { autoAlpha: 0, yPercent: 40 });
        gsap.set(forumIndex.current, { autoAlpha: 0.4, x: 0 });

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: trackRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.1,
            invalidateOnRefresh: true,
          },
        });

        // ---- the camera. One move, running under everything else. ----
        // The photograph is pulling back for the whole sequence and the file is
        // travelling towards the lens for the whole sequence: at no point in the
        // scroll is the frame actually still.
        tl.to(r.chamber, { scale: 1, duration: CUE.daylight }, 0);
        tl.to(r.file, { z: isCinematic ? 190 : 60, duration: CUE.through }, 0);
        tl.to(r.margin, { autoAlpha: 1, duration: 0.05 }, CUE.fileIn);

        // ---- 01 · the file arrives closed ----
        tl.to(cover, {
          autoAlpha: 1,
          y: 0,
          rotationX: 6,
          rotationY: -9,
          rotationZ: -2,
          scale: 1,
          duration: 0.16,
          ease: 'power1.out',
        }, CUE.fileIn);
        tl.to(leaves, {
          autoAlpha: 1,
          duration: 0.12,
          stagger: 0.012,
        }, CUE.fileIn + 0.02);
        tl.to(r.markMatter, { autoAlpha: 1, duration: 0.04 }, CUE.matter - 0.04);

        typeIn(r.mType, CUE.matter);
        typeOut(r.mType, CUE.matterOut);

        // ---- 02 · the cover lifts and the leaves come apart ----
        tl.to(cover, {
          autoAlpha: 0,
          y: () => -geom().plateH * 0.34,
          rotationX: 46,
          scale: 1.06,
          duration: 0.1,
          ease: 'power2.in',
        }, CUE.split);

        // The separation and the standing-up overlap deliberately: the leaves are
        // still spreading when they begin to rise, so there is no moment where the
        // object is merely a fanned stack waiting for the next instruction.
        leaves.forEach((leaf, i) => {
          tl.to(leaf, {
            x: () => bayX(i) * 0.42,
            y: 0,
            z: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            duration: 0.13,
            ease: 'power2.inOut',
          }, CUE.split + i * 0.012);
          // The bay also rises as it stands, into the band `geom()` reserved for
          // it: a column left on the file's centre line would run straight
          // through the chapter title below it.
          tl.to(leaf, {
            x: () => bayX(i),
            y: () => geom().y,
            scaleX: BAY_WIDTH,
            scaleY: () => geom().scaleY,
            duration: 0.17,
            ease: 'power2.inOut',
          }, CUE.bays + i * 0.016);
        });

        tl.to(rulesEls, { autoAlpha: 1, duration: 0.12, stagger: 0.02, ease: 'power1.out' }, CUE.bays + 0.06);
        tl.to(r.datum, { autoAlpha: 1, scaleX: 1, duration: 0.16, ease: 'power2.out' }, CUE.bays + 0.04);
        tl.fromTo(
          headEls,
          { autoAlpha: 0, x: (i) => bayX(i), y: (i, t) => labelY(i, t) + 30, scale: (i, t) => labelFit(t) },
          { autoAlpha: 1, x: (i) => bayX(i), y: labelY, scale: (i, t) => labelFit(t), duration: 0.09, stagger: 0.028, ease: 'power2.out' },
          CUE.heads
        );

        // ---- 03 · the chamber is drawn between the bays ----
        tl.to(r.markMatter, { autoAlpha: 0, duration: 0.03 }, CUE.split);
        tl.to(r.markApproach, { autoAlpha: 1, duration: 0.04 }, CUE.approach - 0.03);

        typeIn(r.aType, CUE.approach);
        typeOut(r.aType, CUE.approachOut);

        // ---- 04 · the camera goes through ----
        // The bays don't fade out where they stand — they pass the lens. Their
        // horizontal throw is what sells the movement, so it runs long and the
        // opacity only gives out once they are already off the edge of frame.
        leaves.forEach((leaf, i) => {
          tl.to(leaf, {
            x: () => bayX(i) * 3.1,
            z: 620,
            scaleY: () => geom().scaleY * 1.22,
            duration: 0.2,
            ease: 'power2.in',
          }, CUE.through + Math.abs(i - (leaves.length - 1) / 2) * 0.012);
          tl.to(leaf, { autoAlpha: 0, duration: 0.09 }, CUE.through + 0.09);
        });
        tl.to(r.datum, { autoAlpha: 0, scaleX: 1.4, duration: 0.12 }, CUE.through);
        tl.to(headEls, { x: (i) => bayX(i) * 2.4, autoAlpha: 0, duration: 0.08, stagger: 0.01 }, CUE.through);

        // ---- 05 · the institution resolves ----
        // Without a colonnade to pass through, the phone has nothing in frame
        // between the file lifting and the photograph arriving — so there the
        // institution starts resolving as the cover goes, and carries the rest
        // of the sequence on its own.
        const resolve = isCinematic ? CUE.through - 0.06 : CUE.split;
        tl.to(r.chamber, { autoAlpha: 1, duration: 0.16, ease: 'power1.out' }, resolve);
        tl.to(r.focus, { filter: 'blur(0px)', duration: isCinematic ? 0.16 : 0.3, ease: 'power1.out' }, resolve + 0.04);
        tl.to(r.photo, { filter: PHOTO_FINAL, duration: isCinematic ? 0.22 : 0.34 }, resolve + 0.02);
        tl.to(r.markApproach, { autoAlpha: 0, duration: 0.03 }, CUE.through + 0.02);
        tl.to(r.markChamber, { autoAlpha: 1, duration: 0.04 }, CUE.chamber - 0.03);

        typeIn(r.cType, CUE.chamber);

        // ---- 06 · the forums name themselves ----
        // Each institution holds the frame alone; the index at the side marks
        // which one is speaking. The last one stays up until the stage hands off.
        const span = (CUE.daylight - 0.03 - CUE.forums) / forums.length;
        forumNames.current.filter(Boolean).forEach((name, i) => {
          const at = CUE.forums + i * span;
          tl.to(name, { autoAlpha: 1, yPercent: 0, duration: span * 0.42, ease: 'power2.out' }, at);
          tl.to(forumIndex.current[i], { autoAlpha: 1, x: 8, duration: span * 0.4 }, at);
          if (i < forums.length - 1) {
            tl.to(name, { autoAlpha: 0, yPercent: -34, duration: span * 0.4, ease: 'power2.in' }, at + span * 0.62);
            tl.to(forumIndex.current[i], { autoAlpha: 0.4, x: 0, duration: span * 0.4 }, at + span * 0.62);
          }
        });

        // ---- 07 · daylight. The camera leaves the chamber for Lead Counsel. ----
        tl.to(r.daylight, { yPercent: 0, duration: 1 - CUE.daylight, ease: 'power2.inOut' }, CUE.daylight);
        tl.set(r.cType, { pointerEvents: 'none' }, CUE.daylight);
        tl.to(r.cType, { opacity: 0, y: -24, duration: 1 - CUE.daylight }, CUE.daylight);
        tl.to(r.margin, { autoAlpha: 0, y: -24, duration: 1 - CUE.daylight }, CUE.daylight);
        tl.to(r.chamber, { scale: 1.04, duration: 1 - CUE.daylight }, CUE.daylight);

        // The chapter that holds the frame is the only one that takes the
        // pointer: the other two are still painted (at zero opacity) directly
        // over it, and an invisible block would otherwise swallow the selection
        // of the copy that is actually being read.
        function typeIn(target, at) {
          if (!target) return;
          tl.fromTo(
            target,
            { opacity: 0, y: 46, filter: 'blur(6px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.1, ease: 'power2.out' },
            at
          );
          tl.set(target, { pointerEvents: 'auto' }, at + 0.05);
        }
        function typeOut(target, at) {
          if (!target) return;
          tl.set(target, { pointerEvents: 'none' }, at);
          tl.to(target, { opacity: 0, y: -40, filter: 'blur(5px)', duration: 0.08, ease: 'power2.in' }, at);
        }
      }
    }, trackRef);

    // Web fonts land after first paint and the chapter type is what sets the
    // stage height, so the trigger is measured again once they have.
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);

    return () => ctx.revert();
  }, [practice.slug]);

  const ref = (k) => (node) => {
    el.current[k] = node;
  };
  const push = (store, i) => (node) => {
    store.current[i] = node;
  };

  return (
    <section className="pcin" ref={trackRef} aria-label={`${practice.title} — the matter, the approach, the chamber`}>
      {/* Scroll anchors for the chapter spine. They take no space and paint
          nothing; each one spans the stretch of track over which its chapter
          actually holds the frame, matching the CUE map above. They have to be
          spans rather than points: the spine watches a thin band at the centre
          of the viewport, and a zero-height marker can pass clean through that
          band between two observer samples on a fast scroll. */}
      <span className="pcin__anchor" id="pd-matter" style={{ top: '0%', height: '30%' }} aria-hidden="true" />
      <span className="pcin__anchor" id="pd-approach" style={{ top: '30%', height: '32%' }} aria-hidden="true" />
      <span className="pcin__anchor" id="pd-chamber" style={{ top: '62%', height: '38%' }} aria-hidden="true" />

      <div className="pcin__stage" ref={ref('stage')}>
        {/* The institution — furthest from the lens, in frame from the first
            millimetre of scroll and still moving on the last. */}
        <div className="pcin__chamber" ref={ref('chamber')} aria-hidden="true">
          <div className="pcin__focus" ref={ref('focus')}>
            <img
              className="pcin__photo"
              ref={ref('photo')}
              src={photo.src}
              srcSet={photo.srcSet}
              sizes="100vw"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="pcin__vignette" />
        </div>

        {/* The datum the colonnade stands on. */}
        <div className="pcin__datum" ref={ref('datum')} aria-hidden="true" />

        {/* THE FILE. One object, three states. */}
        <div className="pcin__file" ref={ref('file')} aria-hidden="true">
          {bayTags.slice(1).map((tag, i) => (
            <div className="pcin__plate pcin__plate--leaf" key={tag} ref={push(plates, i + 1)}>
              <span className="pcin__plate-rule" ref={push(rules, i)} />
            </div>
          ))}

          {/* The heads of work. Siblings of the bays rather than children of
              them: inside a plate they would inherit its 0.44 × N scale and the
              lettering would be crushed. Out here they share the file's depth
              and nothing else. */}
          {bayTags.slice(1).map((tag, i) => (
            <span className="pcin__head" key={tag} ref={push(heads, i)}>
              <b aria-hidden="true" />
              {tag}
            </span>
          ))}

          <div className="pcin__plate pcin__plate--cover" ref={push(plates, 0)}>
            <span className="pcin__plate-mark">File — SLA / Practice</span>
            <span className="pcin__plate-hr" />
            <span className="pcin__plate-title">{practice.title}</span>
            <span className="pcin__plate-foot">
              {practice.tags.length} heads
              <i />
              {forums.length} {forums.length === 1 ? 'forum' : 'forums'}
            </span>
          </div>
        </div>

        {/* Sheet furniture. Not meant to be read at a glance. */}
        <div className="pcin__margin" ref={ref('margin')} aria-hidden="true">
          <span className="pcin__margin-note pcin__margin-note--tl">SLA / Practice Areas</span>
          <span className="pcin__margin-note pcin__margin-note--tr">Hyderabad · Telangana</span>
          <span className="pcin__margin-note pcin__margin-note--run">
            <b ref={ref('markMatter')}>The Matter</b>
            <b ref={ref('markApproach')}>The Approach</b>
            <b ref={ref('markChamber')}>The Chamber</b>
          </span>
          <span className="pcin__margin-note pcin__margin-note--br">{practice.title}</span>
        </div>

        {/* Typography. Three chapters, one slot — the frame never re-composes. */}
        <div className="pcin__type" ref={ref('type')}>
          <div className="pcin__chapter" ref={ref('mType')}>
            <div className="container pcin__chapter-grid">
              <div>
                <span className="pcin__cue"><Icon name="document" /> The Matter</span>
                <h2 className="pcin__title">
                  The <i>Matter</i>
                </h2>
                <span className="pcin__deck">{DECK.matter}</span>
              </div>
              <p className="pcin__body">{practice.matter}</p>
            </div>
          </div>

          <div className="pcin__chapter" ref={ref('aType')}>
            <div className="container pcin__chapter-grid">
              <div>
                <span className="pcin__cue"><Icon name="compass" /> The Approach</span>
                <h2 className="pcin__title">
                  The <i>Approach</i>
                </h2>
                <span className="pcin__deck">{DECK.approach}</span>
              </div>
              <div>
                <p className="pcin__body">{practice.approach}</p>
                {/* The heads of work, in full. On the cinematic stage the bays
                    are carrying them and this list is only for screen readers —
                    the colonnade is aria-hidden scenery. Where there is no
                    colonnade (phone, reduced motion) it becomes the visible
                    editorial index instead of a row of pill badges. */}
                <div className="pcin__heads-block">
                  <span className="pcin__side-label">Heads of work</span>
                  <ul className="pcin__heads">
                    {practice.tags.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="pcin__chapter" ref={ref('cType')}>
            <div className="container pcin__chapter-grid">
              <div>
                <span className="pcin__cue"><Icon name="courthouse" /> The Chamber</span>
                {/* The forum names cycle one at a time, and on their own a
                    courthouse name in display serif is just a place name. Here
                    the deck runs as a lede rather than under the title: the
                    names below it are moving through the slot, and a line
                    sitting under them would be crossed by every hand-off. */}
                <span className="pcin__deck pcin__deck--lede">{DECK.chamber}</span>
                <div className="pcin__forums">
                  {forums.map((f, i) => (
                    <h2 className="pcin__forum" key={f} ref={push(forumNames, i)}>
                      {f}
                    </h2>
                  ))}
                </div>
              </div>
              <div className="pcin__forum-side">
                <span className="pcin__side-label">Forums we appear before</span>
                <ol className="pcin__forum-index">
                  {forums.map((f, i) => (
                    <li key={f} ref={push(forumIndex, i)}>
                      <Icon name="courthouse" />
                      {f}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="pcin__daylight" ref={ref('daylight')} aria-hidden="true" />
      </div>
    </section>
  );
}
