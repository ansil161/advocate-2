import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Link } from 'react-router-dom';
import { consult } from '../../../data/consult.js';
import '../JourneyHero.css';

import frontStill from '../../../assets/journey/front.webp';
import officeStill from '../../../assets/journey/office.webp';

import sridhar from '../../../assets/team/web/sridhar.webp';
import lakshman from '../../../assets/team/web/lakshman.webp';
import aravind from '../../../assets/team/web/aravind.webp';
import manjula from '../../../assets/team/web/manjula.webp';
import ashok from '../../../assets/team/web/ashok.webp';
import vinesh from '../../../assets/team/web/vinesh.webp';
import karupak from '../../../assets/team/web/karupak.webp';
import akshay from '../../../assets/team/web/akshay.webp';
import pawan from '../../../assets/team/web/pawan.webp';
import karthik from '../../../assets/team/web/karthik.webp';
import bharath from '../../../assets/team/web/bharath.webp';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  HOME — THE ARRIVAL
// ------------------------------------------------------------
//  One pinned scroll journey, told in four movements:
//    I.   The front — the firm's building, alive with clients
//         and the real advocates (composited from their actual
//         photos), the camera pushing in toward the steps.
//    II.  The climb — scrubbed footage: up the stone steps,
//         the wooden doors swing open, a lamplit corridor of
//         law books recedes into darkness.
//    III. The bench — out of that darkness, the real team at
//         work in chambers (their actual faces), then each
//         advocate passed one by one in depth.
//    IV.  The desk — an open appointment book, and on it the
//         firm's card: the name and the number. The site's CTA
//         is literally the thing the journey was walking toward.
// ============================================================

// Scrubbed footage lives in /journey as a numbered WebP sequence
// (f_001.webp …): the steps → doors → corridor segment of the
// Flow scene export (the street prefix was cut by request).
const FRAME_COUNT = 115;
const frameSrc = (i) =>
  `${import.meta.env.BASE_URL}journey/f_${String(i + 1).padStart(3, '0')}.webp`;

// Corridor order: senior bench first, walked past in sequence.
// Sridhar is not in the corridor — the corridor arrives at him.
const CORRIDOR = [
  { img: lakshman, name: 'Palanati Lakshman', role: 'Senior Advocate' },
  { img: aravind, name: 'T.V. Arvind', role: 'Advocate' },
  { img: manjula, name: 'Manjula Lendalay', role: 'Associate Advocate' },
  { img: ashok, name: 'Ashok Kumar Shetty', role: 'Advocate' },
  { img: vinesh, name: 'Vinesh Lendalay', role: 'Associate Advocate' },
  { img: karupak, name: 'Beemanaboina Krupakar', role: 'Advocate' },
  { img: akshay, name: 'Akshay Kumar Nakka', role: 'Advocate' },
  { img: pawan, name: 'Pavan Gajjela', role: 'Intern' },
  { img: karthik, name: 'Karthik Yadav', role: 'Advocate' },
  { img: bharath, name: 'Bharath Raj Lendalay', role: 'Law Student' },
];

// Depth layout of the corridor: alternating sides, receding z.
// Units are px of translateZ inside a 1200px-perspective stage.
const PANEL_GAP = 340;
const PANEL_FIRST = -420;
const panelDepth = (i) => PANEL_FIRST - i * PANEL_GAP;
// How far the "camera" (the world's counter-translation) travels:
// past the last panel, with room for the arrival at the desk.
const WORLD_TRAVEL = -panelDepth(CORRIDOR.length - 1) + 620;

// Timeline map — positions on the 0→1 pinned scroll.
const CUE = {
  introOut: 0.04, // the opening title steps aside for the walk
  front: [0.0, 0.2], // building-front still, pushing in
  film: [0.18, 0.54], // footage scrub window (steps → doors → dark)
  cap1: [0.05, 0.15], // "at our door" caption
  cap2: [0.3, 0.42], // "since 2013" caption
  bench: [0.52, 0.72], // office still, pushing in from the dark
  cap3: [0.56, 0.68], // "the bench" caption
  corridor: [0.7, 0.87], // depth travel past each advocate
  arrive: [0.85, 0.93], // corridor hands over to the desk
  card: [0.89, 1.0], // book + card + CTAs settle
};

export default function JourneyHero() {
  const sectionRef = useRef(null);
  const el = useRef({});
  const panelRefs = useRef([]);
  const [still] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useLayoutEffect(() => {
    if (still) return undefined;

    const r = el.current;
    const canvas = r.canvas;
    const ctx = canvas.getContext('2d');

    // ---- footage loader: poster first, then a coarse lattice,
    // then the gaps, so scrubbing never waits on the tail ----
    const images = new Array(FRAME_COUNT).fill(null);
    const loaded = new Array(FRAME_COUNT).fill(false);
    let disposed = false;

    const load = (i) =>
      new Promise((resolve) => {
        if (images[i]) return resolve();
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (!disposed) {
            images[i] = img;
            loaded[i] = true;
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameSrc(i);
      });

    const seq = { frame: 0 };
    let lastDrawn = -1;

    const nearestLoaded = (i) => {
      if (loaded[i]) return i;
      for (let d = 1; d < FRAME_COUNT; d++) {
        if (loaded[i - d]) return i - d;
        if (loaded[i + d]) return i + d;
      }
      return -1;
    };

    const draw = (force = false) => {
      const want = Math.round(seq.frame);
      const have = nearestLoaded(Math.max(0, Math.min(FRAME_COUNT - 1, want)));
      if (have === -1 || (have === lastDrawn && !force)) return;
      lastDrawn = have;
      const img = images[have];
      const cw = canvas.width;
      const ch = canvas.height;
      // cover-fit
      const s = Math.max(cw / img.width, ch / img.height);
      const dw = img.width * s;
      const dh = img.height * s;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      draw(true);
    };
    size();
    window.addEventListener('resize', size);

    (async () => {
      await load(0);
      draw(true);
      for (let i = 0; i < FRAME_COUNT && !disposed; i += 6) await load(i);
      draw(true);
      for (let i = 0; i < FRAME_COUNT && !disposed; i++) {
        if (!loaded[i]) await load(i);
      }
      draw(true);
    })();

    // ---- the scrubbed timeline ----
    const ctx2 = gsap.context(() => {
      const isCompact = window.matchMedia('(max-width: 760px)').matches;
      const world = r.world;
      const span = ([a, b]) => b - a;

      const tl = gsap.timeline({ defaults: { ease: 'none' } });

      // I. the front — a slow push toward the steps
      tl.fromTo(
        r.frontImg,
        { scale: 1.02, yPercent: 0 },
        { scale: 1.17, yPercent: -2.4, duration: span(CUE.front), ease: 'power1.in' },
        CUE.front[0]
      );
      tl.to(r.front, { autoAlpha: 0, duration: 0.05 }, CUE.front[1] - 0.03);

      // opening title steps aside as the walk begins
      tl.to(r.intro, { autoAlpha: 0, y: -30, duration: CUE.introOut, ease: 'power1.in' }, 0);

      // travelling captions
      const caption = (node, [inAt, outAt]) => {
        tl.fromTo(
          node,
          { autoAlpha: 0, y: 24 },
          { autoAlpha: 1, y: 0, duration: 0.035, ease: 'power2.out' },
          inAt
        );
        tl.to(node, { autoAlpha: 0, y: -20, duration: 0.03, ease: 'power1.in' }, outAt);
      };
      caption(r.cap1, CUE.cap1);
      caption(r.cap2, CUE.cap2);
      caption(r.cap3, CUE.cap3);

      // II. the climb — footage scrub, already running under the still
      tl.to(
        seq,
        {
          frame: FRAME_COUNT - 1,
          duration: span(CUE.film),
          snap: { frame: 1 },
          onUpdate: draw,
        },
        CUE.film[0]
      );

      // III. the bench — the office still blooms out of the film's darkness
      tl.fromTo(r.bench, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, CUE.bench[0]);
      tl.fromTo(
        r.benchImg,
        { scale: 1.06, yPercent: 1.5 },
        { scale: 1.2, yPercent: -1.5, duration: span(CUE.bench), ease: 'power1.inOut' },
        CUE.bench[0]
      );
      tl.to(r.film, { autoAlpha: 0, duration: 0.04 }, CUE.bench[0] + 0.03);
      tl.to(r.bench, { autoAlpha: 0, duration: 0.05 }, CUE.corridor[0] + 0.01);

      // …then the corridor of the bench, one advocate at a time
      tl.fromTo(r.office, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, CUE.corridor[0]);
      tl.fromTo(
        world,
        { z: 0 },
        { z: WORLD_TRAVEL, duration: span(CUE.corridor) },
        CUE.corridor[0]
      );

      // each portrait announces itself, then steps past the camera
      panelRefs.current.forEach((panel, i) => {
        if (!panel) return;
        const depth = -panelDepth(i); // positive distance
        const at = CUE.corridor[0] + (depth / WORLD_TRAVEL) * span(CUE.corridor);
        tl.fromTo(
          panel,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.04, ease: 'power1.out' },
          Math.max(CUE.corridor[0], at - 0.08)
        );
        tl.to(panel, { autoAlpha: 0, duration: 0.02, ease: 'power1.in' }, at - 0.008);
      });

      // IV. arrival — corridor recedes, the desk comes up
      tl.to(r.office, { autoAlpha: 0, filter: 'blur(6px)', duration: span(CUE.arrive) }, CUE.arrive[0]);
      tl.fromTo(
        r.final,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: span(CUE.arrive) * 0.7 },
        CUE.arrive[0] + 0.02
      );
      tl.fromTo(
        r.book,
        { yPercent: 26, rotateX: 26, scale: isCompact ? 0.92 : 0.84 },
        { yPercent: 0, rotateX: 9, scale: 1, duration: span(CUE.card), ease: 'power1.out' },
        CUE.card[0]
      );
      tl.fromTo(
        r.card,
        { y: 26, rotateZ: -1.2, boxShadow: '0 6px 18px rgba(0,0,0,0.35)' },
        { y: 0, rotateZ: 1.6, boxShadow: '0 26px 60px rgba(0,0,0,0.55)', duration: 0.07, ease: 'power2.out' },
        CUE.card[0] + 0.05
      );
      tl.fromTo(
        [r.finalEyebrow, r.finalTitle, r.finalCta],
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 0.06, stagger: 0.02, ease: 'power2.out' },
        CUE.card[0] + 0.045
      );

      const st = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: () => `+=${isCompact ? 460 : 560}%`,
        pin: r.stage,
        scrub: true,
        animation: tl,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      });
      // Dev-only handle: the journey can't be scrubbed by setting scrollY in a
      // backgrounded tab (rAF-driven), so expose the trigger + timeline for
      // stepping through by hand, e.g. window.__jhero.tl.progress(0.6).
      if (import.meta.env.DEV) window.__jhero = { st, tl, draw };
    }, sectionRef);

    return () => {
      disposed = true;
      window.removeEventListener('resize', size);
      ctx2.revert();
    };
  }, [still]);

  const ref = (k) => (node) => {
    el.current[k] = node;
  };

  // ------------------------------------------------------------
  //  Reduced motion: no journey — the destination, standing still.
  // ------------------------------------------------------------
  if (still) {
    return (
      <section className="jhero jhero--still" id="hero">
        <div className="jhero__stage">
          <OfficeGround />
          <FinalScene refFn={() => () => {}} staticPose />
        </div>
      </section>
    );
  }

  return (
    <section className="jhero" id="hero" ref={sectionRef}>
      <div className="jhero__stage" ref={ref('stage')}>
        {/* II. the climb (film) — sits under the stills */}
        <div className="jhero__film" ref={ref('film')}>
          <canvas className="jhero__canvas" ref={ref('canvas')} aria-hidden="true" />
          <div className="jhero__film-scrim" aria-hidden="true" />
        </div>

        {/* I. the front — the firm's building, clients and counsel */}
        <div className="jhero__still jhero__still--front" ref={ref('front')} aria-hidden="true">
          <img src={frontStill} alt="" ref={ref('frontImg')} decoding="async" fetchPriority="high" />
          <div className="jhero__film-scrim" />
        </div>

        {/* III-a. the bench at work — the real team, in chambers */}
        <div className="jhero__still jhero__still--bench" ref={ref('bench')} aria-hidden="true">
          <img src={officeStill} alt="" ref={ref('benchImg')} decoding="async" />
          <div className="jhero__still-vignette" />
        </div>

        {/* opening title */}
        <div className="jhero__intro" ref={ref('intro')}>
          <div className="container">
            <span className="eyebrow jhero__intro-eyebrow">
              Hyderabad · Full-Service Litigation &amp; Advisory
            </span>
            <h1 className="jhero__title">
              Justice pursued.
              <em> Recovery executed.</em>
            </h1>
            <p className="jhero__intro-sub">
              Walk with us — through our doors, past the bench, to the desk where
              your matter begins.
            </p>
          </div>
          <div className="jhero__scroll" aria-hidden="true">
            <span>Scroll</span>
            <div className="jhero__scroll-line">
              <i />
            </div>
          </div>
        </div>

        {/* travelling captions */}
        <p className="jhero__caption" ref={ref('cap1')}>
          Clients and counsel —<span> at our door.</span>
        </p>
        <p className="jhero__caption" ref={ref('cap2')}>
          One door has stayed open since 2013.<span> SLA Advocates.</span>
        </p>
        <p className="jhero__caption jhero__caption--office" ref={ref('cap3')}>
          Eleven advocates.<span> Seventy-five years of courtroom, combined.</span>
        </p>

        {/* III-b. the corridor of the bench */}
        <div className="jhero__office" ref={ref('office')} aria-hidden="true">
          <OfficeGround />
          <div className="jhero__persp">
            <div className="jhero__world" ref={ref('world')}>
              {CORRIDOR.map((p, i) => (
                <figure
                  key={p.name}
                  className={`jhero-panel ${i % 2 ? 'jhero-panel--right' : 'jhero-panel--left'}`}
                  ref={(node) => {
                    panelRefs.current[i] = node;
                  }}
                  style={{
                    '--z': `${panelDepth(i)}px`,
                    '--drift': `${(i % 3) - 1}`,
                  }}
                >
                  <span className="jhero-panel__frame">
                    <img src={p.img} alt="" loading="lazy" decoding="async" />
                  </span>
                  <figcaption>
                    <strong>{p.name}</strong>
                    <span>{p.role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>

        {/* IV. the desk */}
        <FinalScene refFn={ref} />
      </div>
    </section>
  );
}

function OfficeGround() {
  return (
    <div className="jhero__ground" aria-hidden="true">
      <div className="jhero__ground-glow" />
      <div className="jhero__ground-floor" />
      <div className="jhero__grain" />
    </div>
  );
}

function FinalScene({ refFn, staticPose = false }) {
  return (
    <div
      className={`jhero__final ${staticPose ? 'is-static' : ''}`}
      ref={refFn('final')}
    >
      <div className="jhero__final-grid container">
        <div className="jhero__final-copy">
          <span className="eyebrow jhero__final-eyebrow" ref={refFn('finalEyebrow')}>
            The journey ends at a desk — yours begins here
          </span>
          <h2 className="jhero__final-title" ref={refFn('finalTitle')}>
            Thirty years of courtroom mastery,
            <em> one number away.</em>
          </h2>
          <div className="jhero__final-cta" ref={refFn('finalCta')}>
            <Link to="/contact" className="btn btn--solid magnetic">
              <span>Book a Consultation</span>
            </Link>
            <Link to="/practice" className="btn btn--line jhero__btn-line magnetic">
              <span>Explore Practice Areas</span>
            </Link>
          </div>
        </div>

        <div className="jhero__desk" aria-hidden={staticPose ? undefined : 'false'}>
          <div className="jhero__book" ref={refFn('book')}>
            <div className="jhero__page jhero__page--left">
              <span className="jhero__page-seal">SLA</span>
              <span className="jhero__page-line">Advocates &amp; Legal Consultants</span>
              <span className="jhero__page-line jhero__page-line--dim">
                Est. 2013 — Hyderabad
              </span>
              <span className="jhero__page-rule" />
              <span className="jhero__page-line jhero__page-line--dim">
                Appointments — {consult.city}
              </span>
            </div>
            <div className="jhero__page jhero__page--right">
              <a className="jhero__card" href={`tel:${consult.phoneHref}`} ref={refFn('card')}>
                <span className="jhero__card-top">
                  <span className="jhero__card-mark">SLA</span>
                  <span className="jhero__card-firm">SLA Advocates</span>
                </span>
                <span className="jhero__card-name">Sridhar Lendalay</span>
                <span className="jhero__card-role">Senior Advocate &amp; Founder</span>
                <span className="jhero__card-phone">{consult.phone}</span>
                <span className="jhero__card-mail">{consult.email}</span>
              </a>
            </div>
            <span className="jhero__book-spine" />
          </div>
          <div className="jhero__desk-surface" />
        </div>
      </div>
    </div>
  );
}
