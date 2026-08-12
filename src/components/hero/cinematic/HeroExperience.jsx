import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createWorld } from './HeroWorld.js';
import { readQuality } from './hero.config.js';
import { stats } from '../../../data/firm.js';
import { practiceAreas } from '../../../data/practiceAreas.js';
import fallbackStill from '../../../assets/journey/front.webp';
import './hero.css';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  SLA — THE ARRIVAL
// ------------------------------------------------------------
//  A single scroll-driven journey through one continuous
//  building: the street outside, the steps, the doors opening,
//  the chambers at work, the library, and finally an open book
//  on a reading table with the firm's record on it.
//
//  One ScrollTrigger drives everything. Its progress is handed
//  to the 3D world (camera, door, people, light, book) and to
//  one GSAP timeline for the small amount of HTML typography
//  laid over it — so the words and the world can never drift
//  out of step with each other.
// ============================================================

// Every figure below is read from the firm's own content files —
// nothing here is authored in this component.
function record() {
  const byLabel = (needle) => stats.find((s) => s.label.toLowerCase().includes(needle));
  const years = byLabel('years at the bar');
  const cases = byLabel('cases');
  return [
    { value: `${years.value}${years.suffix}`, label: 'Years at the Bar' },
    { value: `${cases.value.toLocaleString('en-IN')}${cases.suffix}`, label: 'Cases Handled' },
    { value: `${practiceAreas.length}`, label: 'Practice Areas' },
  ];
}

export default function HeroExperience() {
  const sectionRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const overlay = useRef({});
  const worldRef = useRef(null);
  const [loaded, setLoaded] = useState(0);
  const [state, setState] = useState('loading'); // loading | live | fallback

  const ref = (k) => (node) => {
    overlay.current[k] = node;
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!canvas || !section) return undefined;

    const quality = readQuality();
    const reduce =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      (import.meta.env.DEV && new URLSearchParams(window.location.search).has('still'));
    let world = null;
    let ctx = null;
    let onTick = null;
    let disposed = false;

    // The lettering on the building and in the book is drawn on a
    // canvas, so the display face has to be resident before the
    // textures are baked — otherwise they bake in Georgia.
    const fontsReady = Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((r) => { setTimeout(r, 2500); }),
    ]);

    fontsReady.then(() => {
      if (disposed) return;
      try {
        world = createWorld({
          canvas,
          stats: record(),
          onProgress: (p) => setLoaded(p),
        });
      } catch (err) {
        console.warn('[SLA hero] WebGL unavailable — falling back to the still.', err);
        setState('fallback');
        return;
      }
      worldRef.current = world;

      world.ready.then(() => {
        if (disposed) return;
        world.resize();
        setState('live');

        if (reduce) {
          // No journey — the destination, held still: the reading table
          // with the book already open on it. The headline stays put
          // (it is the page's h1, and hiding it would cost a
          // reduced-motion visitor the whole opening statement); the
          // layout switches to a plain editorial hero via `is-still`.
          world.renderStill(0.99);
          section.classList.add('is-still');
          gsap.set(overlay.current.scroll, { autoAlpha: 0 });
          gsap.set(overlay.current.final, { autoAlpha: 1, y: 0 });
          return;
        }

        ctx = gsap.context(() => {
          const o = overlay.current;
          const tl = gsap.timeline({ defaults: { ease: 'none' } });

          // — the opening title steps aside as the walk begins —
          tl.to(o.intro, { autoAlpha: 0, y: -34, duration: 0.075, ease: 'power1.in' }, 0.03);
          tl.to(o.scroll, { autoAlpha: 0, duration: 0.04 }, 0.02);

          // — two travelling lines, and nothing more —
          const caption = (node, at, out) => {
            tl.fromTo(node, { autoAlpha: 0, y: 22 },
              { autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out' }, at);
            tl.to(node, { autoAlpha: 0, y: -18, duration: 0.03, ease: 'power1.in' }, out);
          };
          caption(o.cap1, 0.20, 0.36);
          caption(o.cap2, 0.50, 0.60);
          caption(o.cap3, 0.70, 0.80);

          // — the way out: the record is on the page of the book, so the
          //   overlay only carries what has to be a real link. It comes
          //   up while the spread is still opening, so it is on screen
          //   long enough to be used. —
          tl.fromTo(o.final, { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, duration: 0.035, ease: 'power2.out' }, 0.935);

          const st = ScrollTrigger.create({
            trigger: section,
            start: 'top top',
            end: () => `+=${quality.scrollLength}%`,
            pin: stage,
            pinSpacing: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            animation: tl,
            onUpdate: (self) => world.setProgress(self.progress),
            onToggle: (self) => document.body.classList.toggle('is-cinema', self.isActive),
          });

          if (import.meta.env.DEV) window.__hero = { world, st, tl };
        }, section);

        ScrollTrigger.refresh();
      });
    });

    // One render loop, on gsap's ticker so it shares a clock with
    // Lenis and the scrubbed timeline. It only draws while the stage
    // is actually on screen.
    onTick = (_time, deltaMs) => {
      const w = worldRef.current;
      if (!w || !w.isReady || reduce) return;
      const r = stage.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
      w.tick(Math.min(deltaMs / 1000, 1 / 20));
    };
    gsap.ticker.add(onTick);

    const onResize = () => worldRef.current?.resize();
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      gsap.ticker.remove(onTick);
      window.removeEventListener('resize', onResize);
      document.body.classList.remove('is-cinema');
      ctx?.revert();
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, []);

  // Keep the pinned section measured correctly once the fonts and the
  // first frame have settled.
  useEffect(() => {
    if (state === 'live') {
      const id = setTimeout(() => ScrollTrigger.refresh(), 120);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [state]);

  if (state === 'fallback') {
    return (
      <section className="chero chero--fallback is-still" id="hero" ref={sectionRef}>
        <div className="chero__stage" ref={stageRef}>
          <img className="chero__poster" src={fallbackStill} alt="" />
          <div className="chero__scrim" />
          <Intro refFn={ref} />
          <Final refFn={ref} visible />
        </div>
      </section>
    );
  }

  return (
    <section className="chero" id="hero" ref={sectionRef}>
      <div className="chero__stage" ref={stageRef}>
        <canvas className="chero__canvas" ref={canvasRef} aria-hidden="true" />
        <div className="chero__scrim" aria-hidden="true" />

        <div className={`chero__loader ${state === 'live' ? 'is-done' : ''}`} aria-hidden={state === 'live'}>
          <span className="chero__loader-mark">SLA</span>
          <span className="chero__loader-line">
            <i style={{ transform: `scaleX(${Math.max(0.04, loaded)})` }} />
          </span>
          <span className="chero__loader-word">Entering</span>
        </div>

        <Intro refFn={ref} />

        <p className="chero__caption" ref={ref('cap1')}>
          Clients and counsel — <span>at our door.</span>
        </p>
        <p className="chero__caption" ref={ref('cap2')}>
          One door has stayed open <span>since 2013.</span>
        </p>
        <p className="chero__caption" ref={ref('cap3')}>
          Eleven advocates. <span>Seventy-five years of courtroom, combined.</span>
        </p>

        <Final refFn={ref} />
      </div>
    </section>
  );
}

function Intro({ refFn }) {
  return (
    <>
      <div className="chero__intro" ref={refFn('intro')}>
        <div className="container">
          <span className="chero__eyebrow">Est. 2013 — Hyderabad</span>
          <h1 className="chero__title">SLA Advocates</h1>
          <p className="chero__sub">Advocates &amp; Legal Consultants</p>
        </div>
      </div>
      <div className="chero__scroll" ref={refFn('scroll')} aria-hidden="true">
        <span>Scroll to enter</span>
        <i />
      </div>
    </>
  );
}

function Final({ refFn, visible = false }) {
  return (
    <div className={`chero__final ${visible ? 'is-visible' : ''}`} ref={refFn('final')}>
      <div className="chero__final-inner">
        <span className="chero__final-note">The desk your matter begins at</span>
        <div className="chero__final-cta">
          <Link to="/contact" className="btn btn--solid magnetic"><span>Book a Consultation</span></Link>
          <Link to="/practice" className="btn btn--line chero__btn-line magnetic"><span>Explore Practice Areas</span></Link>
        </div>
      </div>
    </div>
  );
}
