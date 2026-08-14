import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createRevealMasks } from '../lib/revealMask.js';
import { getLenis } from '../../../lib/useLenis.js';

import photoLg from '../../../assets/img/sla-building.webp';
import photoSm from '../../../assets/img/sla-building-760.webp';
import lineKey from '../../../assets/img/sla-line-key.webp';
import lineFull from '../../../assets/img/sla-line-full.webp';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  ABOUT — OPENING SEQUENCE
// ------------------------------------------------------------
//  A title sequence, not a scroll toy: the master timeline plays once, on its
//  own clock, the moment the page opens. Scroll is locked and the nav is off
//  the sheet for the duration, then both hand back to the visitor together.
//
//  The building arrives the way a building actually arrives — as a drawing
//  first, then as a massing model, then as the finished render. That is the
//  real order of architectural practice, and the plate here is a render, so
//  the sequence is running its own production pipeline backwards to front.
//
//  All three layers are the same building at three stages of resolution, and
//  they register on each other exactly: the linework is Sobel-derived from this
//  very render (see sla-line-*.webp), which is why the drawn edges sit
//  precisely on the glass when the render resolves underneath them.
//
//  Phase map — positions on the 0→1 master timeline:
// ============================================================
const CUE = {
  datum: 0.045,      // construction lines strike across the empty sheet
  keyLines: 0.10,    // the primary structural edges are laid in
  fullLines: 0.20,   // the elevation is completed; annotations appear
  model: 0.34,       // the sheet lifts — the drawing stands up as a plaster model
  bloom: 0.46,       // the photograph wicks outward from the heart of the portico
  resolved: 0.74,    // full architecture, sharp
  ink: 0.60,         // the light goes; ivory gives way to the dark composition
  title: 0.775,      // SLA ADVOCATES
  withdraw: 0.94,    // the camera pulls back and hands off to the story
};

const NOTE_PAPER = '#3d3629';
const NOTE_INK = 'rgba(247,244,236,0.52)';

// The two states the architecture is graded between. The gap between them is
// what makes the reveal legible: the veil has to stay unmistakably paler and
// flatter than the photograph for the whole bloom, or the front dissolving
// across the colonnade reads as nothing at all.
const CLAY_FLAT = 'grayscale(1) sepia(0.5) brightness(2.3) contrast(0.18)';
const CLAY_MODELLED = 'grayscale(1) sepia(0.44) brightness(1.94) contrast(0.4)';
const PHOTO_LATENT = 'saturate(0.3) sepia(0.2) brightness(1.24) contrast(0.9)';
// Not pure monochrome: the render's whole subject is a glass building lit from
// within at dusk, and flattening it to grey throws away the one thing that
// makes it read as evening. A heavy desaturation keeps the warm interiors and
// the cool sky just distinguishable, inside the black / ivory palette.
const PHOTO_FINAL = 'saturate(0.24) sepia(0.14) brightness(1.02) contrast(1.16)';

export default function AboutHero() {
  const sectionRef = useRef(null);
  const el = useRef({});

  useLayoutEffect(() => {
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
      //  Reduced motion: the last frame of the film, and nothing else.
      // --------------------------------------------------------
      function buildStill() {
        const r = el.current;
        gsap.set([r.wash, r.key, r.draw, r.clay], { autoAlpha: 0 });
        gsap.set(r.focus, { filter: 'blur(0px)' });
        gsap.set([r.photo, r.bleedPlate], { autoAlpha: 1, filter: PHOTO_FINAL });
        gsap.set(r.bleed, { autoAlpha: 1 });
        gsap.set([r.camPhoto, r.camDraw], { scale: 1, yPercent: 0 });
        gsap.set(r.ink, { autoAlpha: 1 });
        gsap.set(r.notation, { autoAlpha: 0.85, color: NOTE_INK });
        gsap.set([r.datumH, r.datumV], { scaleX: 1, scaleY: 1, autoAlpha: 0.2, backgroundColor: NOTE_INK });
        gsap.set(r.accent, { scaleX: 1, autoAlpha: 0.5 });
        gsap.fromTo(
          [r.title, r.metaTop, r.metaRow],
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: 'power2.out' }
        );
        gsap.set(r.mark, { autoAlpha: 0 });
        // The stage opens dark here rather than arriving there, so the fixed
        // chrome has to be told so from the first frame — and told again the
        // moment the cream sections below take over.
        document.body.classList.remove('ahero-paper');
        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          toggleClass: { targets: document.body, className: 'ahero-dark' },
        });
      }

      // --------------------------------------------------------
      //  The full take.
      // --------------------------------------------------------
      function build(isCinematic) {
        const r = el.current;
        // Desktop gets the full luxurious take; phones get the same film, cut down.
        const TOTAL_SECONDS = isCinematic ? 7 : 5.5;

        const masks = createRevealMasks(
          isCinematic
            ? { cx: 0.45, cy: 0.56, rx: 0.36, ry: 0.48, stages: 44, amp: 0.3 }
            : { cx: 0.5, cy: 0.5, rx: 0.42, ry: 0.5, stages: 26, amp: 0.2 }
        );

        // Blur is the one genuinely expensive filter in the chain, and it rides
        // on its own wrapper so it can resolve on a different curve from the
        // grading underneath it. On phones the beat is carried by the bloom and
        // the camera alone.
        const softFocus = isCinematic ? 'blur(10px)' : 'blur(0px)';

        // A shorter approach than the choreography really wants. The plate is
        // 1000px square, so every extra 0.1 of opening scale is upscale the
        // final frame has to pay for; 1.12 is as far as it can be pushed before
        // the glass starts to soften visibly.
        const camFrom = isCinematic ? 1.12 : 1.1;
        const camY = isCinematic ? 2.4 : 1.8;

        // ---- opening frame: an empty sheet ----
        gsap.set(r.wash, { autoAlpha: 1 });
        gsap.set([r.key, r.draw], { autoAlpha: 0 });
        gsap.set(r.clay, {
          autoAlpha: 1,
          filter: CLAY_FLAT,
          maskImage: `url(${masks.at(0).url})`,
          webkitMaskImage: `url(${masks.at(0).url})`,
        });
        gsap.set(r.focus, { filter: softFocus });
        gsap.set([r.photo, r.bleedPlate], { autoAlpha: 1, filter: PHOTO_LATENT });
        gsap.set(r.bleed, { autoAlpha: 0 });
        gsap.set([r.camPhoto, r.camDraw], { scale: camFrom, yPercent: camY, transformOrigin: '58% 48%' });
        gsap.set(r.ink, { autoAlpha: 0 });
        gsap.set(r.notation, { autoAlpha: 0, color: NOTE_PAPER });
        gsap.set([r.datumH, r.datumV], { autoAlpha: 0, backgroundColor: NOTE_PAPER });
        gsap.set(r.datumH, { scaleX: 0 });
        gsap.set(r.datumV, { scaleY: 0 });
        gsap.set(r.accent, { scaleX: 0, autoAlpha: 0 });
        gsap.set([r.title, r.metaTop, r.metaRow], { autoAlpha: 0 });
        gsap.set(r.mark, { autoAlpha: 0 });

        // The fixed chrome sits above all of this and has to be told which way
        // the stage has turned. The nav would otherwise go to its scrolled dark
        // treatment while the stage is still an ivory sheet; the chapter rail
        // would stay on its light-background treatment after the stage goes dark.
        // One switch, thrown by the timeline, drives both.
        const paper = { v: 1 };
        const setGround = (isPaper) => {
          document.body.classList.toggle('ahero-paper', isPaper);
          document.body.classList.toggle('ahero-dark', !isPaper);
        };
        // Past the hero the page owns its own backgrounds again, so neither
        // override may survive the section.
        const clearGround = () => document.body.classList.remove('ahero-paper', 'ahero-dark');
        setGround(true);

        // The nav sits above the sheet like everything else in the stage, so it
        // waits for its cue rather than sitting there the whole time. Scroll is
        // held for the same span — the film is meant to be watched, not raced
        // past — and both let go together when the take lands.
        //
        // Lenis is looked up fresh at each call rather than captured once: this
        // effect is a useLayoutEffect, which — on first mount — fires before
        // useLenis's own (plain useEffect) instance-creation runs, so a value
        // grabbed up front here can still be null when it's actually needed.
        const navEl = document.querySelector('.nav-bar');
        document.body.classList.add('ahero-intro');
        document.documentElement.classList.add('scroll-locked');
        getLenis()?.stop();
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          document.body.classList.remove('ahero-intro');
          document.documentElement.classList.remove('scroll-locked');
          getLenis()?.start();
        };
        if (navEl) gsap.set(navEl, { autoAlpha: 0, y: -16 });

        const reveal = { v: 0 };
        let boundStage = -1;
        const bindMask = () => {
          const { index, url } = masks.at(reveal.v);
          if (index === boundStage) return;
          boundStage = index;
          r.clay.style.webkitMaskImage = `url(${url})`;
          r.clay.style.maskImage = `url(${url})`;
        };

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' }, onComplete: release });

        // ---- 01 · the empty sheet, and the firm's mark on it ----
        tl.to(r.mark, { autoAlpha: 1, duration: 0.03, ease: 'power1.out' }, 0.005);

        // ---- 02 · construction lines ----
        tl.to(r.datumH, { autoAlpha: 0.3, scaleX: 1, duration: 0.075, ease: 'power2.inOut' }, CUE.datum);
        tl.to(r.datumV, { autoAlpha: 0.26, scaleY: 1, duration: 0.09, ease: 'power2.inOut' }, CUE.datum + 0.02);
        tl.to(r.accent, { autoAlpha: 0.85, scaleX: 1, duration: 0.07, ease: 'power2.out' }, CUE.datum + 0.035);

        // ---- 03 · the drawing ----
        tl.to(r.key, { autoAlpha: 0.62, duration: 0.13, ease: 'power1.inOut' }, CUE.keyLines);
        tl.to(r.draw, { autoAlpha: 0.92, duration: 0.15, ease: 'power1.inOut' }, CUE.fullLines);
        tl.to(r.key, { autoAlpha: 0.3, duration: 0.12 }, CUE.fullLines + 0.03);
        tl.to(r.notation, { autoAlpha: 1, duration: 0.1, ease: 'power1.out' }, CUE.fullLines + 0.01);
        tl.to(r.mark, { autoAlpha: 0, duration: 0.06 }, CUE.keyLines + 0.02);

        // ---- 04 · the sheet lifts; the drawing stands up as a model ----
        tl.to(r.wash, { autoAlpha: 0, duration: 0.11, ease: 'power1.inOut' }, CUE.model);
        tl.to(r.clay, { filter: CLAY_MODELLED, duration: 0.14 }, CUE.model);
        tl.to(r.key, { autoAlpha: 0, duration: 0.1 }, CUE.model + 0.02);
        tl.to(r.draw, { autoAlpha: 0.34, duration: 0.12 }, CUE.model + 0.04);

        // ---- 05 · the photograph blooms out of the colonnade ----
        tl.to(
          reveal,
          { v: 1, duration: CUE.resolved - CUE.bloom, ease: 'none', onUpdate: bindMask },
          CUE.bloom
        );
        // Focus resolves faster than the bloom spreads, so the front is always
        // running into ground that has already come sharp behind it.
        tl.to(r.focus, { filter: 'blur(0px)', duration: 0.2, ease: 'power1.out' }, CUE.bloom);
        tl.to([r.photo, r.bleedPlate], { filter: PHOTO_FINAL, duration: 0.24 }, CUE.bloom);
        // The flanks fill as the render wicks outward, not before: while the
        // sheet is still a sheet, empty margin either side is the composition.
        tl.to(r.bleed, { autoAlpha: 1, duration: 0.22, ease: 'power1.out' }, CUE.bloom + 0.02);
        tl.to(r.draw, { autoAlpha: 0, duration: 0.14 }, CUE.bloom + 0.04);
        // Belt and braces: by here the mask has cleared every corner, but fading
        // the veil out guarantees no pale residue survives into the final frame.
        tl.to(r.clay, { autoAlpha: 0, duration: 0.05 }, CUE.resolved - 0.03);

        // ---- 06 · the light goes ----
        tl.to(r.ink, { autoAlpha: 1, duration: 0.3, ease: 'power1.in' }, CUE.ink);
        tl.to(r.notation, { color: NOTE_INK, duration: 0.22 }, CUE.ink + 0.02);
        tl.to([r.datumH, r.datumV], { backgroundColor: NOTE_INK, autoAlpha: 0.2, duration: 0.22 }, CUE.ink + 0.02);
        // The drawing's scaffolding steps aside for the title: the vertical datum
        // would otherwise run straight through the letterforms, and the gold rule
        // sits exactly where the title's shoulder lands.
        tl.to([r.datumV, r.accent], { autoAlpha: 0, duration: 0.06 }, CUE.title - 0.05);
        tl.to(r.datumH, { autoAlpha: 0.12, duration: 0.06 }, CUE.title - 0.05);

        // ---- camera: one slow approach across the whole take ----
        tl.to([r.camPhoto, r.camDraw], { scale: 1, yPercent: 0, duration: CUE.withdraw }, 0);

        // ---- 07 · the title emerges as the architecture settles ----
        tl.fromTo(
          r.metaTop,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' },
          CUE.title - 0.03
        );
        tl.fromTo(
          r.title,
          { autoAlpha: 0, yPercent: 14, scale: 1.045, letterSpacing: '0.16em' },
          { autoAlpha: 1, yPercent: 0, scale: 1, letterSpacing: '0.005em', duration: 0.15, ease: 'power2.out' },
          CUE.title
        );
        tl.fromTo(
          r.metaRow,
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out' },
          CUE.title + 0.06
        );

        // ---- 08 · the camera withdraws into the story ----
        tl.to([r.camPhoto, r.camDraw], { scale: 0.975, yPercent: -1.6, duration: 1 - CUE.withdraw }, CUE.withdraw);
        tl.to([r.title, r.metaTop, r.metaRow], { y: -10, duration: 1 - CUE.withdraw }, CUE.withdraw);

        tl.to(paper, { v: 0, duration: 0.16, onUpdate: () => setGround(paper.v > 0.5) }, CUE.ink);

        // ---- 09 · the nav comes onto the sheet, once the building has landed ----
        if (navEl) {
          tl.to(navEl, { autoAlpha: 1, y: 0, duration: 0.12, ease: 'power2.out' }, CUE.title + 0.05);
        }

        // The mask ladder plays out almost immediately at this pace, so it has
        // to be ready before the timeline reaches it rather than baked lazily.
        masks.prebake();
        tl.duration(TOTAL_SECONDS).play();
        // Dev-only handle for scrubbing the intro by hand — e.g. window.__aheroTl.progress(0.8) —
        // since it otherwise only ever plays once, automatically, on its own clock.
        if (import.meta.env.DEV) window.__aheroTl = tl;

        // The intro plays once and never again — past it, this is an ordinary
        // (unpinned, unscrubbed) trigger that keeps the nav/rail theme in sync
        // with the hero scrolling in and out of view, the same switch the
        // timeline threw once, now driven by scroll position instead.
        const groundTrigger = ScrollTrigger.create({
          trigger: sectionRef.current,
          start: 'top top',
          end: 'bottom top',
          onLeave: clearGround,
          onLeaveBack: clearGround,
          onEnterBack: () => setGround(false),
        });

        return () => {
          tl.kill();
          groundTrigger.kill();
          masks.dispose();
          clearGround();
          document.body.classList.remove('ahero-intro');
          document.documentElement.classList.remove('scroll-locked');
          getLenis()?.start();
        };
      }
    }, sectionRef);

    return () => {
      ctx.revert();
      document.body.classList.remove('ahero-paper', 'ahero-dark', 'ahero-intro');
      document.documentElement.classList.remove('scroll-locked');
    };
  }, []);

  const ref = (k) => (node) => {
    el.current[k] = node;
  };

  return (
    <section className="ahero" id="a-hero" ref={sectionRef}>
      <div className="ahero__stage">
        <div className="ahero__paper" aria-hidden="true" />

        {/* The architecture, at full resolution */}
        <div className="ahero__camera" ref={ref('camPhoto')} aria-hidden="true">
          {/* The flanks. The render is square and the stage is wide, so the
              contained plate below leaves a third of the frame empty either
              side of the building. This is the same photograph blown past both
              edges and thrown well out of focus, so the dusk sky and the wet
              road carry on to the gutters instead of stopping at a hard line —
              the whole elevation still reads, and nothing is cropped off it.
              It arrives with the bloom: before that the flanks are the ivory
              sheet, which is the point of the first half of the take. */}
          <div className="ahero__bleed" ref={ref('bleed')}>
            <img className="ahero__bleed-plate" ref={ref('bleedPlate')} src={photoSm} alt="" decoding="async" />
          </div>
          {/* The plate's own left and right edges, hard against the blurred
              flanks, cut two vertical seams through the sky. `.ahero__frame` is
              the painted square itself rather than the wide camera box, so a
              percentage feather on it lands on the real edges — both the render
              and the veil above it dissolve into the flank instead of stopping. */}
          <div className="ahero__frame">
            {/* Focus rides on its own wrapper so the photograph can come sharp on a
                different curve from the grading, without either fighting the other
                for the single `filter` property. */}
            <div className="ahero__focus" ref={ref('focus')}>
              <img
                className="ahero__plate ahero__plate--photo"
                ref={ref('photo')}
                src={photoLg}
                srcSet={`${photoSm} 760w, ${photoLg} 1000w`}
                sizes="100vw"
                alt=""
                decoding="async"
                fetchPriority="high"
              />
            </div>
            {/* The massing model — the same building, unresolved. This is the
                layer the render eats its way out of. */}
            <img
              className="ahero__plate ahero__plate--clay"
              ref={ref('clay')}
              src={photoLg}
              srcSet={`${photoSm} 760w, ${photoLg} 1000w`}
              sizes="100vw"
              alt=""
              decoding="async"
            />
          </div>
        </div>

        <div className="ahero__wash" ref={ref('wash')} aria-hidden="true" />

        {/* The drawing, above the sheet */}
        <div className="ahero__camera ahero__camera--draw" ref={ref('camDraw')} aria-hidden="true">
          <div className="ahero__frame">
            <img
              className="ahero__plate ahero__plate--line"
              ref={ref('draw')}
              src={lineFull}
              alt=""
              decoding="async"
            />
            <img
              className="ahero__plate ahero__plate--line"
              ref={ref('key')}
              src={lineKey}
              alt=""
              decoding="async"
            />
          </div>
        </div>

        <div className="ahero__ink" ref={ref('ink')} aria-hidden="true" />

        {/* Sheet furniture: datum lines, dimension callouts, a survey reference.
            None of it is meant to be read at a glance. */}
        <div className="ahero__datum ahero__datum--h" ref={ref('datumH')} aria-hidden="true" />
        <div className="ahero__datum ahero__datum--v" ref={ref('datumV')} aria-hidden="true" />
        <div className="ahero__accent" ref={ref('accent')} aria-hidden="true" />

        <div className="ahero__notation" ref={ref('notation')} aria-hidden="true">
          <span className="ahero__note ahero__note--tl">Plate — Elevation</span>
          <span className="ahero__note ahero__note--tr">Sec. A–A</span>
          <span className="ahero__note ahero__note--ml">
            17.3850° N
            <i />
            78.4867° E
          </span>
          <span className="ahero__note ahero__note--mr">Scale 1 : 200</span>
          <span className="ahero__note ahero__note--bl">SLA / About</span>
          <span className="ahero__note ahero__note--br">Glazed curtain wall</span>
        </div>

        <div className="ahero__grain" aria-hidden="true" />

        <span className="ahero__mark" ref={ref('mark')} aria-hidden="true">
          SLA
        </span>

        {/* Deliberately not `.container`: the title is full-bleed, so its
            supporting type aligns to the viewport gutters too. Constraining
            these to the 1360px measure leaves them visibly adrift from the
            title's edges on wide displays. */}
        <div className="ahero__type">
          <span className="ahero__meta-top" ref={ref('metaTop')}>
            <i />
            About the firm
          </span>
          <h1 className="ahero__title" ref={ref('title')}>
            SLA Advocates
          </h1>
          <div className="ahero__meta-row" ref={ref('metaRow')}>
            <span>Est. 2013</span>
            <span>Hyderabad, Telangana</span>
            <span>Advocates — India</span>
          </div>
        </div>
      </div>
    </section>
  );
}
