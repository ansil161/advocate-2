import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon from '../../../components/ui/Icon.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { milestones } from '../../../data/awards.js';
import { ROAD_EYE, ROAD_UNITS, blendedPath, lengthFractions, pathFromKnots, roadKnots } from '../lib/roadPath.js';

import statueImg from '../../../assets/img/justice-statue.webp';
import chambersImg from '../../../assets/img/bench-chambers.webp';
import colonnadeImg from '../../../assets/img/colonnade-diagonal.webp';
import signageImg from '../../../assets/journey/signage.webp';
import officeImg from '../../../assets/journey/office.webp';
import frontImg from '../../../assets/journey/front.webp';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  LEGACY — THREE DECADES, ONE STANDARD
// ------------------------------------------------------------
//  The firm's history, told as a journey rather than a table. One road is
//  drawn through the whole section; every milestone in data/awards.js is a
//  stop on it, and the scroll is the camera travelling between them.
//
//  Three viewports, three builds, one story:
//
//    wide      a sticky cinematic stage driven by ONE master timeline —
//              road, camera, markers, plates and typography are all cues on
//              the same 0→1 scrub, so nothing can ever be fighting anything
//              else for the frame.
//    column    a dedicated phone choreography: the road stands up vertical,
//              the chapters run down it in ordinary flow, and each one
//              arrives as it is reached. Not the wide stage, shrunk.
//    still     prefers-reduced-motion: the same column, fully drawn and
//              fully still. Every word and every image is present.
//
//  Content is read from data/awards.js and never restated here. The image
//  map below is a slot architecture, not a claim: these are the project's
//  existing photographs, chosen for what a chapter is *about* — none of them
//  is presented as an archival record of the event beside it. Swap a src for
//  real material and nothing else has to change.
// ============================================================

const WIDE_Q = '(min-width: 861px)';
const STILL_Q = '(prefers-reduced-motion: reduce)';

// Timeline map — positions on the 0→1 master scrub of the wide stage.
const OPEN = 0.11; // the title card holds, then the road begins
// The closing fifth is its own act: the arrival, the road unfolding into a map,
// a beat to read it, and the fall through the doorway. It needs room.
const CLOSE = 0.8;

// How each chapter's photograph takes the frame.
//
// Every one of these is a transform. Nothing here animates `clip-path`, a
// `filter` or a box-shadow, because those three are the properties a browser
// cannot composite: each one costs a fresh raster on every scroll frame, and
// on a scrubbed timeline that is exactly where the judder comes from. The
// window is a fixed box with `overflow: hidden`; the leaf inside it slides.
// The plates are stacked in order, so a leaf sliding in covers the one before
// it — which is the page-turn the brief asked for, and means no chapter needs
// an exit tween at all.
const MOVES = {
  rise: { yPercent: 100 }, // lifts into the window — the opening chapter
  drift: { xPercent: -100 }, // enters from the left
  hold: { scale: 1.16, autoAlpha: 0 }, // settles rather than wipes — the authoritative chapter
  turn: { xPercent: 100 }, // enters from the right — the turning point
  open: { yPercent: -100 }, // lowers into place — the arrival
};

// The image slot for each milestone, keyed by the year string in
// data/awards.js so a change to the history can never silently re-assign a
// photograph to the wrong chapter — an unmatched milestone renders an
// explicit empty slot instead. Alt text describes the photograph, not the
// history: none of these images is a record of the event it accompanies.
const PLATES = {
  '1996': {
    img: statueImg,
    alt: 'A blindfolded figure of Justice holding up the scales, beneath a glazed roof.',
    pos: '50% 45%',
    move: 'rise',
  },
  '2005': {
    img: chambersImg,
    alt: 'A panelled law library wall of glazed bookcases, lit by candle sconces.',
    pos: '50% 50%',
    move: 'drift',
  },
  '2012–2015': {
    img: colonnadeImg,
    alt: 'The stone colonnade of a courthouse facade, seen along its length.',
    pos: '50% 42%',
    move: 'hold',
  },
  '2013': {
    img: signageImg,
    alt: 'Brass lettering on a wood-panelled wall reading SLA Advocates — Sridhar Lendalay Associates Advocates.',
    pos: '50% 50%',
    move: 'turn',
    // Polished brass under direct light: the shared grade blows this one out
    // to near-white, so it is pulled down and hardened to hold the lettering.
    grade: 'grayscale(1) contrast(1.22) brightness(0.78)',
  },
  '2021–2024': {
    img: officeImg,
    alt: 'Advocates at work around a chambers desk, law reports shelved behind them.',
    pos: '50% 42%',
    move: 'drift',
  },
  Today: {
    img: frontImg,
    alt: 'Advocates and clients on the steps of a court building.',
    pos: '50% 48%',
    move: 'open',
  },
};

// Diameter of the doorway disc at rest, in px. It only ever appears scaled, so
// this is just the unit the closing scale is expressed in.
const PORTAL = 120;

const CHAPTERS = milestones.map((m) => ({ ...m, plate: PLATES[m.year] ?? null }));
const N = CHAPTERS.length;
const SPAN = (CLOSE - OPEN) / N; // one chapter's share of the scroll
const at = (i) => OPEN + i * SPAN;

// The hand-over, in fractions of one chapter's span. These four numbers are
// the whole rhythm of the section, and the one rule they have to obey is that
// the next chapter must already be arriving while this one is still leaving:
// LEAVE + OUT must land after 1 − IN, or the stage empties out between
// milestones and the journey reads as a gap rather than a cut.
const CUE = {
  typeIn: 0.22, // how far ahead of its stop a chapter's type starts arriving
  plateIn: 0.3, // …and its photograph, which leads the type in
  leave: 0.62, // when the camera pulls away and the chapter starts going
  typeOut: 0.26, // how long the type takes to go
  // The outgoing photograph holds its ground until the next one is already
  // wiping across it — plates are stacked in order, so the incoming plate
  // covers the outgoing rather than trading places with an empty frame.
  plateOutAt: 0.86,
  plateOut: 0.24,
};
const pad = (n) => String(n).padStart(2, '0');

// A supporting line, not a claim: both halves of it are already in the data
// above — the 1996 enrolment, and a bench that reached eleven by 2024.
const DECK = 'One enrolment at the Bar, and every turn it has taken since.';

// ------------------------------------------------------------
//  Which build to run. Read once, then kept in step with the viewport and
//  with the visitor's motion preference.
// ------------------------------------------------------------
function useStageMode() {
  const read = () => {
    if (typeof window === 'undefined') return 'wide';
    if (window.matchMedia(STILL_Q).matches) return 'still';
    return window.matchMedia(WIDE_Q).matches ? 'wide' : 'column';
  };
  const [mode, setMode] = useState(read);

  useEffect(() => {
    const wide = window.matchMedia(WIDE_Q);
    const still = window.matchMedia(STILL_Q);
    const sync = () => setMode(still.matches ? 'still' : wide.matches ? 'wide' : 'column');
    sync();
    wide.addEventListener('change', sync);
    still.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      still.removeEventListener('change', sync);
    };
  }, []);

  return mode;
}

export default function LegacyRoad() {
  const mode = useStageMode();
  return mode === 'wide' ? <RoadStage /> : <RoadColumn still={mode === 'still'} />;
}

// ============================================================
//  THE WIDE STAGE
// ============================================================
function RoadStage() {
  const trackRef = useRef(null);
  const el = useRef({});
  const marks = useRef([]);
  const plates = useRef([]);
  const leaves = useRef([]);
  const chapters = useRef([]);
  const roadPaths = useRef([]);
  const atlasPaths = useRef([]);
  const pins = useRef([]);

  // Normalised knots: x is a percentage of the stage width, y a percentage of
  // its height. `measure()` turns them into px against the live stage.
  const knots = roadKnots(N);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const r = el.current;
      const markEls = marks.current.filter(Boolean);
      const plateEls = plates.current.filter(Boolean);
      const leafEls = leaves.current.filter(Boolean);
      const chapterEls = chapters.current.filter(Boolean);
      const dots = markEls.map((m) => m.querySelector('.lroad__dot'));
      const rings = markEls.map((m) => m.querySelector('.lroad__ring'));
      const road = roadPaths.current.filter(Boolean);
      const atlasAll = atlasPaths.current.filter(Boolean);
      const atlas = atlasAll.slice(0, 2); // verge + surface: the two that draw
      const pinEls = pins.current.filter(Boolean);
      if (!road.length || !r.stage || !r.map || !r.atlas || atlasAll.length < 3) return;

      // ---- geometry ----
      // The road is authored straight into px: the viewBox is set to the
      // element's own pixel box, so the SVG's scale is exactly 1 and a stroke
      // is never scaled. The alternative — a normalised viewBox stretched to
      // the stage with vector-effect="non-scaling-stroke" — makes Chrome
      // re-derive stroke geometry under a wildly non-uniform transform on
      // every redraw, and at this size that is enough to hang the renderer.
      // Everything is re-measured from the trigger's own refresh, so a resize
      // re-lays the road rather than stretching it.
      const LANE = 22; // half the road's own weight, plus a little
      const GAP = 20; // between the road's edge and a plate
      let len = 0;
      let alen = 0;
      let frac = [];
      let pts = [];

      const measure = () => {
        const w = r.stage.offsetWidth;
        const sh = r.stage.offsetHeight;
        const h = (ROAD_UNITS / 100) * sh;
        pts = knots.map((k) => ({ x: (k.x / 100) * w, y: (k.y / 100) * sh }));
        const path = pathFromKnots(pts, { lead: sh * 0.42, tail: sh * 0.26 });

        r.travel.style.height = `${h}px`;
        r.map.setAttribute('viewBox', `0 0 ${w} ${h}`);
        road.forEach((p) => p.setAttribute('d', path));

        len = road[0].getTotalLength();
        frac = lengthFractions(road[0], pts);
        gsap.set(road, { strokeDasharray: len });

        // The map, laid out once against the same stage. Static from here on:
        // the closing move only animates its dash.
        const mk = mapKnots();
        const mapD = blendedPath(mk, 1, { bow: 0.56, lead: sh * 0.12, tail: sh * 0.26 });
        r.atlas.querySelector('svg').setAttribute('viewBox', `0 0 ${w} ${sh}`);
        atlasAll.forEach((p) => p.setAttribute('d', mapD));
        alen = atlas[0].getTotalLength();
        gsap.set(atlas, { strokeDasharray: alen });
        pinEls.forEach((p, i) => {
          p.style.left = `${mk[i].x}px`;
          p.style.top = `${mk[i].y}px`;
        });

        // Markers are HTML, not SVG: they carry type, and type inside the
        // viewBox would be stretched with it. Same coordinate space, though.
        markEls.forEach((m, i) => {
          m.style.left = `${pts[i].x}px`;
          m.style.top = `${pts[i].y}px`;
        });
      };
      measure();

      // Where the road has reached, and where the camera has to stand for that
      // milestone to sit at eye level. Both are read through functions so
      // `invalidateOnRefresh` picks up whatever `measure()` last found.
      const draw = (i) => len * (1 - frac[i]);
      const cam = (i) => r.stage.offsetHeight * ROAD_EYE - pts[i].y;

      // The last shot: the camera pulls all the way back until the whole road
      // — every milestone from the first to the last — is in one frame. The
      // transform origin is the wrapper's own corner, so this is just
      // `p → s·p + (x, y)`: fit the road's full length into the stage with a
      // tenth of it as margin, and stand it in the right-hand two thirds so
      // the closing line can sit in the column the chapters were using.
      // ---- the map ----
      // The road doesn't shrink into a corner at the end; it unfolds. The same
      // milestones are re-laid across the full width of the stage — a journey
      // read left to right instead of top to bottom — and the road is redrawn
      // between the two layouts every frame, so it turns rather than cuts.
      // Everything about the map is derived from the stage it has to fit in.
      // The road snakes: milestones sit alternately low and high, and the road
      // sweeps between them across the full width — the first stop bottom-left,
      // the last one top-right, running on off the edge of the frame. Each
      // photograph hangs off its own milestone on the side the road leans away
      // from, and the bottom of the stage is kept clear for the closing line.
      // The amplitude is whatever is left once the plates have their room, so
      // the whole thing composes itself on a short laptop as well as a desk.


      function mapBand() {
        const w = r.stage.offsetWidth;
        const sh = r.stage.offsetHeight;
        const pitch = (w * 0.76) / Math.max(N - 1, 1);
        const plateW = Math.min(pitch * 0.84, 230, sh * 0.4);
        const plateH = plateW / 1.5;
        const reach = LANE + GAP + plateH / 2; // knot → centre of its plate
        const mid = sh * 0.5;
        // …tall enough to read as a journey, never so tall that a plate is
        // pushed off the stage or into the closing line's band.
        const amp = Math.max(sh * 0.06, Math.min(sh * 0.17, sh * 0.36 - reach - plateH / 2));
        return { w, sh, pitch, plateW, plateH, reach, mid, amp };
      };

      function mapKnots() {
        const b = mapBand();
        const x0 = b.w * 0.12;
        return Array.from({ length: N }, (_, i) => ({
          x: x0 + i * b.pitch,
          y: b.mid + (i % 2 ? -b.amp : b.amp), // starts low on the left, ends high
        }));
      };

      // Where each photograph goes once the road is a map: level with its own
      // milestone, and on the side the road leans away from, so no plate ever
      // sits on the line. Measured off `offsetLeft/Width` — layout values, so
      // they are not disturbed by whatever transform the frame is carrying.
      function gallery() {
        const b = mapBand();
        const knots = mapKnots();
        const box = {
          x: r.frames.offsetLeft + r.frame.offsetLeft,
          y: r.frames.offsetTop + r.frame.offsetTop,
          w: r.frame.offsetWidth,
          h: r.frame.offsetHeight,
        };
        return {
          scale: b.plateW / box.w,
          x: (i) => knots[i].x - (box.x + box.w / 2),
          // A milestone in a trough carries its photograph below the road, one
          // on a crest carries it above — so no plate ever sits on the line.
          y: (i) => knots[i].y + (i % 2 ? -b.reach : b.reach) - (box.y + box.h / 2),
        };
      };

      // ---- opening frame ----
      gsap.set(road, { strokeDashoffset: len });
      gsap.set(r.road, { autoAlpha: 0 });
      // Corner origin, so the closing pull-back is a plain scale-about-(0,0)
      // and the camera translations during the journey are unaffected.
      gsap.set(r.travel, { transformOrigin: '0 0' });
      gsap.set(r.coda, { opacity: 0, y: 18, pointerEvents: 'none' });
      gsap.set(r.portal, { scale: 0, autoAlpha: 0, backgroundColor: '#12141a' });
      gsap.set(r.atlas, { autoAlpha: 0 });
      gsap.set(r.atlasLane, { opacity: 0 });
      gsap.set(pinEls, { autoAlpha: 0 });
      gsap.set(markEls, { autoAlpha: 0 });
      gsap.set(dots, { scale: 0.5 });
      gsap.set(rings, { autoAlpha: 0, scale: 0.55 });
      // The stack of plates is always there; it is the window that is shut, and
      // every leaf that is parked off it. Nothing here carries a filter — a
      // filter, even `blur(0px)`, gives an element its own compositing layer
      // for the whole scroll.
      gsap.set(plateEls, { autoAlpha: 1 });
      gsap.set(leafEls, { yPercent: 100 });
      gsap.set(r.frame, { autoAlpha: 0 });
      // `opacity`, deliberately not `autoAlpha`: all six chapters are stacked
      // in one slot, and hiding them by visibility would take five sixths of
      // this section's text out of the accessibility tree and out of in-page
      // find at every scroll position.
      gsap.set(chapterEls, { opacity: 0, pointerEvents: 'none' });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: trackRef.current,
          start: 'top top',
          end: 'bottom bottom',
          // Enough smoothing to keep the camera unhurried, little enough that a
          // fast flick doesn't leave the stage a second behind the scroll —
          // which reads as the section being empty until you stop moving.
          scrub: 0.6,
          invalidateOnRefresh: true,
          onRefreshInit: measure,
        },
      });

      // ---- I. the title card, then the road ----
      // The camera holds still under the title. Written as a fromTo so the
      // opening position is re-read on refresh instead of being baked in.
      tl.fromTo(r.travel, { y: () => cam(0) }, { y: () => cam(0), duration: OPEN }, 0);
      // `opacity`, not `autoAlpha`: the title card carries this section's only
      // <h2>, and taking it out of the accessibility tree for the rest of the
      // scroll would leave the section headless.
      // The card leaves late and slowly enough that the first chapter is
      // already arriving underneath it — the two cross-dissolve rather than
      // leaving a stretch of empty ivory between them.
      tl.to(r.intro, { opacity: 0, y: -36, duration: OPEN * 0.46, ease: 'power2.in' }, OPEN * 0.6);
      tl.set(r.intro, { pointerEvents: 'none' }, OPEN);
      tl.to(r.road, { autoAlpha: 1, duration: OPEN * 0.55, ease: 'power2.out' }, OPEN * 0.3);
      tl.fromTo(
        road,
        { strokeDashoffset: () => len },
        { strokeDashoffset: () => draw(0), duration: OPEN * 0.7, ease: 'power2.out' },
        OPEN * 0.3
      );
      // the window opens once, for the whole journey
      tl.to(r.frame, { autoAlpha: 1, duration: SPAN * 0.3, ease: 'power2.out' }, at(0) - SPAN * 0.4);

      // ---- II. the chapters ----
      CHAPTERS.forEach((c, i) => {
        const start = at(i);
        const leave = start + SPAN * CUE.leave; // the camera pulls away from here
        const last = i === N - 1;

        // the marker arrives with the road, and stays legible after it
        tl.to(markEls[i], { autoAlpha: 1, duration: SPAN * 0.22, ease: 'power2.out' }, start - SPAN * 0.4);
        tl.to(dots[i], { scale: 1, duration: SPAN * 0.3, ease: 'power3.out' }, start - SPAN * 0.34);
        tl.to(rings[i], { autoAlpha: 1, scale: 1, duration: SPAN * 0.32, ease: 'power2.out' }, start - SPAN * 0.26);

        // the photograph — one transform, sliding in over the one before it
        const leaf = leafEls[i];
        if (leaf) {
          const move = MOVES[c.plate?.move] ?? MOVES.drift;
          tl.fromTo(
            leaf,
            { ...move },
            {
              xPercent: 0,
              yPercent: 0,
              scale: 1,
              autoAlpha: 1,
              duration: SPAN * (move === MOVES.hold ? 0.52 : 0.44),
              ease: 'power3.inOut',
            },
            start - SPAN * CUE.plateIn
          );
          // a slow drift inside the window for as long as the chapter holds it
          const img = leaf.querySelector('img');
          if (img) {
            tl.fromTo(
              img,
              { yPercent: -1.8 },
              { yPercent: 1.8, duration: SPAN * 1.15 },
              start - SPAN * CUE.plateIn
            );
          }
        }

        // the typography
        tl.fromTo(
          chapterEls[i],
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: SPAN * 0.34, ease: 'power3.out' },
          start - SPAN * CUE.typeIn
        );
        tl.set(chapterEls[i], { pointerEvents: 'auto' }, start - SPAN * 0.1);

        // The Bench chapter grades the room a shade deeper, and gives it back.
        if (c.plate?.move === 'hold') {
          tl.to(r.tone, { opacity: 0.9, duration: SPAN * 0.5, ease: 'power2.inOut' }, start - SPAN * 0.3);
          tl.to(r.tone, { opacity: 0, duration: SPAN * 0.55, ease: 'power2.inOut' }, start + SPAN * 0.7);
        }

        if (last) return;

        // ---- the hand-over: nothing cuts ----
        // The outgoing chapter is still leaving while the camera is already
        // moving and the road is already drawing on toward the next stop.
        tl.set(chapterEls[i], { pointerEvents: 'none' }, leave);
        tl.to(chapterEls[i], { opacity: 0, y: -30, duration: SPAN * CUE.typeOut, ease: 'power2.in' }, leave);
        // No exit for the photograph: the next one slides over it. That is one
        // fewer tween per chapter, and it is also the truer gesture.
        tl.to(markEls[i], { autoAlpha: 0.42, duration: SPAN * 0.36 }, leave + SPAN * 0.04);
        tl.to(dots[i], { scale: 0.74, duration: SPAN * 0.36 }, leave + SPAN * 0.04);
        tl.to(rings[i], { autoAlpha: 0, duration: SPAN * 0.3 }, leave + SPAN * 0.04);

        tl.fromTo(
          r.travel,
          { y: () => cam(i) },
          { y: () => cam(i + 1), duration: SPAN * 0.5, ease: 'power3.inOut' },
          leave - SPAN * 0.04
        );
        tl.fromTo(
          road,
          { strokeDashoffset: () => draw(i) },
          { strokeDashoffset: () => draw(i + 1), duration: SPAN * 0.52, ease: 'power2.inOut' },
          leave - SPAN * 0.04
        );
      });

      // ---- III. the arrival, and the whole road at last ----
      // Three moves, in order: the last photograph takes the frame; the camera
      // pulls back until the entire journey is in one shot — every milestone
      // it just travelled, drawn end to end; and then the light goes out of the
      // stage, which is how this section hands over to the dark one below it
      // without a seam.
      const tail = 1 - CLOSE;
      const T = (f) => CLOSE + tail * f;

      // …the arrival: the last photograph takes the frame and holds it
      tl.to(r.frame, { scale: 1.24, xPercent: -8, duration: tail * 0.16, ease: 'power3.inOut' }, T(0));
      tl.set(chapterEls[N - 1], { pointerEvents: 'none' }, T(0.16));
      tl.to(chapterEls[N - 1], { opacity: 0, y: -26, duration: tail * 0.12, ease: 'power2.in' }, T(0.16));

      // …the unfolding. One long move on expo: the camera rises off the last
      // milestone while the road turns from a journey down the frame into a map
      // across it. The path is re-emitted each frame from knots interpolated
      // between the two layouts, and the markers ride the same interpolation,
      // so the whole thing is one gesture and reverses exactly.
      // The map is a second, static road. It is not the journey's path bent
      // into a new shape frame by frame — rebuilding four path strings on every
      // scroll frame is precisely the kind of work that makes a scrub judder.
      // It is laid out once by `measure()` and then simply draws itself, which
      // costs one animated attribute, while the journey road recedes behind it
      // and the pins drop in as the route reaches them.
      const PULL = { at: T(0.2), dur: tail * 0.42, ease: 'expo.inOut' };

      // …the journey road lets go
      tl.to(r.frame, { scale: 1, xPercent: 0, duration: PULL.dur * 0.45, ease: 'power2.inOut' }, PULL.at);
      tl.to(r.travel, { y: () => cam(N - 1) - r.stage.offsetHeight * 0.12, duration: PULL.dur, ease: PULL.ease }, PULL.at);
      tl.to(r.road, { autoAlpha: 0, duration: PULL.dur * 0.45, ease: 'power2.inOut' }, PULL.at + tail * 0.04);

      // …and the route draws across the frame in its place
      tl.set(r.atlas, { autoAlpha: 1 }, PULL.at);
      tl.fromTo(
        atlas,
        { strokeDashoffset: () => alen },
        { strokeDashoffset: 0, duration: PULL.dur * 0.92, ease: 'power2.inOut' },
        PULL.at
      );
      tl.to(r.atlasLane, { opacity: 1, duration: PULL.dur * 0.3, ease: 'power2.out' }, PULL.at + PULL.dur * 0.72);

      // …with a pin dropping at each milestone as the route reaches it
      pinEls.forEach((pin, i) => {
        tl.fromTo(
          pin,
          { autoAlpha: 0, y: -18, scale: 0.7 },
          { autoAlpha: 1, y: 0, scale: 1, duration: PULL.dur * 0.26, ease: 'power3.out' },
          PULL.at + PULL.dur * (0.12 + 0.74 * (i / Math.max(N - 1, 1)))
        );
      });

      // …and the memories come with it. The six plates are stacked in one
      // window all through the journey; here that stack is dealt out along the
      // road, each photograph settling beside the milestone it belongs to.
      // Last on top goes first, so the pile is revealed as it empties.
      plateEls.forEach((plate, i) => {
        if (!plate) return;
        const dealt = PULL.at + tail * 0.04 + (N - 1 - i) * tail * 0.03;
        tl.to(
          plate,
          {
            x: () => gallery().x(i),
            y: () => gallery().y(i),
            scale: () => gallery().scale,
            duration: PULL.dur * 0.88,
            ease: PULL.ease,
          },
          dealt
        );
      });

      // …the closing line, under the map, and then the map simply holds — a
      // beat with nothing moving in it, which is the only reason the fall that
      // follows reads as a decision rather than more scrolling.
      tl.to(r.coda, { opacity: 1, y: 0, duration: tail * 0.12, ease: 'power2.out' }, T(0.5));

      // ---- IV. through the road ----
      // The hand-over is a match cut, not a wipe. The road's surface is already
      // the colour of the section underneath this one, so the last milestone is
      // treated as a doorway: the camera falls into it (accelerating, never
      // eased out — you don't decelerate into a door), and the road's own dark
      // opens out of that point until it is the whole frame. When the stage
      // finally releases, the black the visitor is looking at and the black of
      // the section below are the same black, so nothing appears to change over
      // at all — they have simply arrived.
      const doorway = () => mapKnots()[N - 1];
      const cover = () => {
        const w = r.stage.offsetWidth;
        const sh = r.stage.offsetHeight;
        const k = doorway();
        // far enough to clear the furthest corner from the doorway
        return (Math.hypot(Math.max(k.x, w - k.x), Math.max(k.y, sh - k.y)) * 2.1) / PORTAL;
      };
      const origin = () => `${doorway().x}px ${doorway().y}px`;

      // the door is marked before it opens — the last pin on the map, which is
      // what the visitor is actually looking at by now
      if (pinEls[N - 1]) tl.to(pinEls[N - 1], { scale: 1.5, duration: tail * 0.06, ease: 'power2.out' }, T(0.76));

      // the fall. `power2.in` and nothing else: the camera accelerates the
      // whole way in and never eases out, because you do not decelerate into a
      // doorway — the cut happens while you are still moving.
      tl.to(r.atlas, { scale: 1.28, transformOrigin: origin, duration: tail * 0.2, ease: 'power2.in' }, T(0.8));
      tl.to(
        r.frames,
        { scale: 1.16, autoAlpha: 0, transformOrigin: origin, duration: tail * 0.13, ease: 'power2.in' },
        T(0.8)
      );
      tl.to(r.coda, { opacity: 0, y: -20, duration: tail * 0.09, ease: 'power2.in' }, T(0.8));

      // the door itself, opening out of the road's own colour and settling on
      // the exact black of the section below
      tl.set(r.portal, { x: () => doorway().x, y: () => doorway().y, autoAlpha: 1 }, T(0.82));
      tl.fromTo(r.portal, { scale: 0 }, { scale: cover, duration: tail * 0.17, ease: 'expo.inOut' }, T(0.82));
      tl.to(r.portal, { backgroundColor: '#0a0a0a', duration: tail * 0.09, ease: 'none' }, T(0.9));

      // Dev-only handle: a scrubbed journey can't be inspected by setting
      // window.scrollY (Lenis owns the position), so expose the timeline for
      // stepping through by hand — window.__lroad.tl.progress(0.6).
      if (import.meta.env.DEV) window.__lroad = { tl, st: tl.scrollTrigger };
    }, trackRef);

    // The chapter type sets the height of nothing here, but the web fonts
    // still land after first paint and move the markers' labels — measure
    // again once they have.
    const refresh = () => ScrollTrigger.refresh();
    if (document.fonts?.ready) document.fonts.ready.then(refresh);

    return () => ctx.revert();
  }, []);

  const ref = (k) => (node) => {
    el.current[k] = node;
  };
  const push = (store, i) => (node) => {
    store.current[i] = node;
  };

  return (
    <section className="lroad" id="a-legacy" ref={trackRef} aria-label="The SLA story — three decades, one standard">
      <div className="lroad__scroll" style={{ '--chapters': N, '--road-units': ROAD_UNITS }}>
        <div className="lroad__stage" ref={ref('stage')}>
          <div className="lroad__tone" ref={ref('tone')} aria-hidden="true" />
          <div className="lroad__grain" aria-hidden="true" />

          {/* THE ROAD. Clipped and feathered by the stage; the travelling
              layer inside it is what the camera actually moves. */}
          <div className="lroad__road" ref={ref('road')} aria-hidden="true">
            <div className="lroad__travel" ref={ref('travel')}>
              {/* The road is four strokes of one path, drawn on together by a
                  single dash tween. Deliberately NOT an SVG mask: a mask over
                  a stage-sized viewBox has to re-rasterise a multi-megapixel
                  offscreen buffer on every scrub frame. Dashing the strokes
                  themselves only ever repaints what is on screen.
                  The viewBox and the `d` are written by the timeline's own
                  measure pass — see the geometry note there. */}
              <svg
                className="lroad__map"
                ref={ref('map')}
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path ref={push(roadPaths, 0)} className="lroad__path lroad__path--haze" />
                <path ref={push(roadPaths, 1)} className="lroad__path lroad__path--verge" />
                <path ref={push(roadPaths, 2)} className="lroad__path lroad__path--surface" />
                <path ref={push(roadPaths, 3)} className="lroad__path lroad__path--centre" />
              </svg>

              {CHAPTERS.map((c, i) => (
                <span className="lroad__mark" key={c.year} ref={push(marks, i)}>
                  <span className="lroad__mark-year">{c.year}</span>
                  <i className="lroad__ring" />
                  <i className="lroad__dot" />
                </span>
              ))}
            </div>
          </div>

          {/* THE MAP. A second, static road that draws itself at the close —
              see the note on the closing move. Nothing here moves during the
              journey; it isn't even painted until then. */}
          <div className="lroad__atlas" ref={ref('atlas')} aria-hidden="true">
            <svg preserveAspectRatio="none" focusable="false">
              <path ref={push(atlasPaths, 0)} className="lroad__path lroad__path--verge" />
              <path ref={push(atlasPaths, 1)} className="lroad__path lroad__path--surface" />
              <path
                ref={(node) => {
                  atlasPaths.current[2] = node;
                  el.current.atlasLane = node;
                }}
                className="lroad__path lroad__path--lane"
              />
            </svg>
            {CHAPTERS.map((c, i) => (
              <span className="lroad__pin" key={c.year} ref={push(pins, i)}>
                <i />
                <b>{c.year}</b>
              </span>
            ))}
          </div>

          {/* THE MEMORIES. One frame, six plates, never two in it at once. */}
          <div className="lroad__frames" ref={ref('frames')}>
            <div className="lroad__frame" ref={ref('frame')}>
              {CHAPTERS.map((c, i) => (
                <figure className="lroad__plate" key={c.year} ref={push(plates, i)}>
                  {/* The leaf is what moves; the plate is the window it moves
                      behind. Two elements so the reveal can be a transform. */}
                  <span className="lroad__leaf" ref={push(leaves, i)}>
                    {c.plate ? (
                      <img
                        src={c.plate.img}
                        alt={c.plate.alt}
                        style={{ objectPosition: c.plate.pos, filter: c.plate.grade }}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="lroad__slot">Image slot — {c.year}</span>
                    )}
                  </span>
                  <span className="lroad__plate-edge" aria-hidden="true" />
                </figure>
              ))}
            </div>
          </div>

          {/* THE AUTHORITY. Six chapters, one slot — the frame never
              re-composes itself between them. */}
          <div className="lroad__type">
            {CHAPTERS.map((c, i) => (
              <article
                className={`lroad__chapter${c.plate?.move === 'hold' ? ' lroad__chapter--strong' : ''}`}
                key={c.year}
                ref={push(chapters, i)}
              >
                <span className="lroad__chapter-index">
                  {pad(i + 1)} <i /> {pad(N)}
                </span>
                <span className="lroad__chapter-year">{c.year}</span>
                <h3 className="lroad__chapter-title">{c.title}</h3>
                <p className="lroad__chapter-body">{c.body}</p>
              </article>
            ))}

          </div>

          {/* The coda, under the finished map. It says nothing new: the
              section's own line, and the span of the road above it, read off
              the first and last milestones in the data. */}
          <div className="lroad__coda" ref={ref('coda')} aria-hidden="true">
            <span className="lroad__coda-rule" />
            <p className="lroad__coda-line">
              Three decades. <em>One standard.</em>
            </p>
            <span className="lroad__coda-years">
              {CHAPTERS[0].year} — {CHAPTERS[N - 1].year}
            </span>
          </div>

          {/* The doorway. Sits at the last milestone and opens out of the road's
              own colour — see the closing move in the timeline. */}
          <div className="lroad__portal" ref={ref('portal')} aria-hidden="true" />

          {/* THE TITLE CARD. Calm and editorial, before anything moves. */}
          <div className="lroad__intro" ref={ref('intro')}>
            <span className="chapter-label">
              <Icon name="book" /> The SLA Story
            </span>
            {/* A low viewport threshold on purpose: this title sits in a
                sticky stage and enters from the bottom edge of the screen, so
                it has to start setting as soon as it appears — at the default
                0.6 it is still rising when the stage locks and the timeline
                has already begun taking it away. */}
            <h2 className="lroad__head">
              <SplitText text="Three decades." amount={0.1} />
              <em>
                <SplitText text="One standard." delay={0.18} amount={0.1} />
              </em>
            </h2>
            <p className="lroad__deck">{DECK}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
//  THE COLUMN — phone, and prefers-reduced-motion
// ------------------------------------------------------------
//  The road stands up. Every chapter is in ordinary flow, in order, with its
//  own photograph under it — nothing is pinned, nothing is stacked in a slot,
//  and nothing has to move for the section to be read.
// ============================================================
function RoadColumn({ still }) {
  const rootRef = useRef(null);
  const stripRef = useRef(null);
  const rows = useRef([]);
  const dots = useRef([]);
  const paths = useRef([]);
  const mapRef = useRef(null);

  const COL_W = 46; // px across the strip — mirrored by --strip in the CSS

  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;

    // The knots are wherever the milestone dots actually landed, so the road
    // runs through them whatever the copy does to the row heights. Authored in
    // px against the strip's own box, so the SVG never scales a stroke.
    const build = () => {
      const box = strip.getBoundingClientRect();
      if (!box.height) return;
      const knots = dots.current.filter(Boolean).map((dot) => {
        const d = dot.getBoundingClientRect();
        return { x: COL_W / 2, y: d.top + d.height / 2 - box.top };
      });
      if (!knots.length) return;
      const d = pathFromKnots(knots, { sway: 9, bow: 0.4, lead: 30, tail: 64 });
      mapRef.current?.setAttribute('viewBox', `0 0 ${COL_W} ${Math.round(box.height)}`);
      paths.current.filter(Boolean).forEach((p) => p.setAttribute('d', d));
    };

    build();
    if (still) return undefined;

    const ctx = gsap.context(() => {
      const road = paths.current.filter(Boolean);
      if (!road.length) return;

      const arm = () => {
        const len = road[0].getTotalLength();
        gsap.set(road, { strokeDasharray: len, strokeDashoffset: len });
        return len;
      };
      let len = arm();

      // The road draws itself against the section's own progress — one
      // scrub for the whole column, not one per milestone.
      gsap.fromTo(
        road,
        { strokeDashoffset: () => len },
        {
          strokeDashoffset: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: strip,
            start: 'top 76%',
            end: 'bottom 72%',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefreshInit: () => {
              build();
              len = arm();
            },
          },
        }
      );

      rows.current.filter(Boolean).forEach((row) => {
        gsap.fromTo(
          row,
          { autoAlpha: 0, y: 26 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: row, start: 'top 86%', once: true },
          }
        );
        const img = row.querySelector('img');
        if (img) {
          gsap.fromTo(
            img,
            { scale: 1.08 },
            {
              scale: 1,
              ease: 'none',
              scrollTrigger: { trigger: img, start: 'top bottom', end: 'bottom top', scrub: true },
            }
          );
        }
      });
    }, rootRef);

    const refresh = () => {
      build();
      ScrollTrigger.refresh();
    };
    if (document.fonts?.ready) document.fonts.ready.then(refresh);

    return () => ctx.revert();
  }, [still]);

  const push = (store, i) => (node) => {
    store.current[i] = node;
  };

  return (
    <section className={`lroad lroad--column${still ? ' lroad--still' : ''}`} id="a-legacy">
      <div className="container">
        <span className="chapter-label">
          <Icon name="book" /> The SLA Story
        </span>
        <h2 className="lroad__head">
          {still ? 'Three decades.' : <SplitText text="Three decades." />}
          <em>{still ? 'One standard.' : <SplitText text="One standard." delay={0.18} />}</em>
        </h2>
        <p className="lroad__deck">{DECK}</p>

        <div className="lroad__col" ref={stripRef}>
          <svg
            className="lroad__col-map"
            ref={mapRef}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path ref={push(paths, 0)} className="lroad__path lroad__path--verge" />
            <path ref={push(paths, 1)} className="lroad__path lroad__path--surface" />
            <path ref={push(paths, 2)} className="lroad__path lroad__path--centre" />
          </svg>

          {CHAPTERS.map((c, i) => (
            <article className="lroad__row" key={c.year} ref={push(rows, i)}>
              <i className="lroad__row-dot" ref={push(dots, i)} aria-hidden="true" />
              <span className="lroad__chapter-index">
                {pad(i + 1)} <i /> {pad(N)}
              </span>
              <span className="lroad__chapter-year">{c.year}</span>
              <h3 className="lroad__chapter-title">{c.title}</h3>
              <p className="lroad__chapter-body">{c.body}</p>
              <figure className="lroad__row-plate">
                {c.plate ? (
                  <img
                    src={c.plate.img}
                    alt={c.plate.alt}
                    style={{ objectPosition: c.plate.pos, filter: c.plate.grade }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="lroad__slot">Image slot — {c.year}</span>
                )}
              </figure>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
