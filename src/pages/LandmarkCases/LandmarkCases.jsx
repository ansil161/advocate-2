import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Layout from '../../components/shell/Layout.jsx';
import Consult from '../../components/shell/Consult.jsx';
import CaseDossier from './sections/CaseDossier.jsx';
import { landmarkCases, disclaimer } from '../../data/landmarkCases.js';
import bgImg from '../../assets/img/bookshelf-mono.webp';
import './LandmarkCases.css';

gsap.registerPlugin(ScrollTrigger);

const EASE = 'power2.out';
const MQ = {
  motion: '(prefers-reduced-motion: no-preference)',
  cinematic: '(min-width: 861px) and (prefers-reduced-motion: no-preference)',
};

export default function LandmarkCases() {
  const rootRef = useRef(null);
  const archiveRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ── opening frame ────────────────────────────────────────
      mm.add(MQ.motion, () => {
        const tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.from('.lc-hero__img', { scale: 1.16, duration: 2.6 }, 0)
          .from('.lc-hero__label', { autoAlpha: 0, y: 14, duration: 0.9 }, 0.15)
          .from('.lc-hero__line-inner', { yPercent: 118, duration: 1.15, stagger: 0.1 }, 0.25)
          .from('.lc-hero__statement', { autoAlpha: 0, y: 18, duration: 1 }, 0.8)
          .from('.lc-hero__foot > *', { autoAlpha: 0, y: 12, duration: 0.9, stagger: 0.08 }, 0.95)
          .from('.lc-hero__cue', { autoAlpha: 0, duration: 0.8 }, 1.15);
      });

      // ── the hand-off ─────────────────────────────────────────
      // The hero is sticky, so the cream archive sheet rises over it as one
      // continuous move rather than the page cutting between two screens.
      // Every tween below is scrubbed against that same window — from the
      // moment the sheet's edge enters the viewport to the moment it lands
      // against the top — so the camera push, the dimming and the type
      // lifting away all resolve exactly as the second section arrives.
      mm.add(MQ.cinematic, () => {
        const window_ = { trigger: archiveRef.current, start: 'top bottom', end: 'top top', scrub: 0.6 };

        gsap.to('.lc-hero__media', { yPercent: 10, scale: 1.09, ease: 'none', scrollTrigger: window_ });
        gsap.to('.lc-hero__dim', { opacity: 0.72, ease: 'none', scrollTrigger: window_ });
        gsap.to('.lc-hero__inner', {
          yPercent: -12,
          autoAlpha: 0,
          ease: 'none',
          scrollTrigger: { ...window_, end: 'top 40%' },
        });
        gsap.to('.lc-hero__foot, .lc-hero__cue', {
          autoAlpha: 0,
          ease: 'none',
          scrollTrigger: { ...window_, end: 'top 72%' },
        });

        // The sheet doesn't just slide up — it settles. A short lag on the
        // archive's own content reads as paper coming to rest under the edge.
        gsap.from('.lc-archive__inner', {
          yPercent: 6,
          ease: 'none',
          scrollTrigger: { ...window_, end: 'top 20%' },
        });
      });

      // ── the archive arriving ─────────────────────────────────
      mm.add(MQ.motion, () => {
        gsap.from('.lc-head__label, .lc-head__title, .lc-head__note', {
          autoAlpha: 0,
          y: 32,
          duration: 1.05,
          stagger: 0.09,
          ease: EASE,
          scrollTrigger: { trigger: '.lc-head', start: 'top 86%', once: true },
        });
        gsap.from('.lc-head__rule', {
          scaleX: 0,
          duration: 1.3,
          ease: EASE,
          scrollTrigger: { trigger: '.lc-head', start: 'top 86%', once: true },
        });
        gsap.from('.cd-rail__label, .cd-tab', {
          autoAlpha: 0,
          x: -18,
          duration: 0.9,
          stagger: 0.06,
          ease: EASE,
          scrollTrigger: { trigger: '.cd', start: 'top 78%', once: true },
        });
        gsap.from('.cd-file', {
          autoAlpha: 0,
          y: 44,
          duration: 1.2,
          ease: EASE,
          scrollTrigger: { trigger: '.cd', start: 'top 78%', once: true },
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <Layout navTheme="dark">
      <div className="lc-stage" ref={rootRef}>
        <section className="lc-hero" id="lc-hero">
          <div className="lc-hero__media" aria-hidden="true">
            <img className="lc-hero__img" src={bgImg} alt="" fetchPriority="high" />
            <div className="lc-hero__scrim" />
            <div className="lc-hero__dim" />
          </div>
          <div className="lc-hero__grid" aria-hidden="true" />
          <div className="lc-grain" aria-hidden="true" />

          <div className="container lc-hero__inner">
            <span className="lc-hero__label">Landmark Cases — The File</span>
            <h1 className="lc-hero__title">
              <span className="lc-hero__line"><span className="lc-hero__line-inner">A record built</span></span>
              <span className="lc-hero__line"><span className="lc-hero__line-inner">matter by matter.</span></span>
            </h1>
            <p className="lc-hero__statement">
              Two decades of appearances, reduced to the matters that changed something.
            </p>
          </div>

          <div className="container lc-hero__foot">
            <span><i>Matters</i>2,000+ since 1996</span>
            <span><i>Forums</i>District Courts to the High Court</span>
            <span className="lc-hero__file">SLA / LMC / 01–06</span>
          </div>

          <div className="lc-hero__cue" aria-hidden="true">
            <span>Open the file</span>
            <i />
          </div>
        </section>

        <section className="lc-archive" id="lc-archive" ref={archiveRef}>
          <div className="lc-archive__edge" aria-hidden="true" />
          <div className="lc-grain lc-grain--paper" aria-hidden="true" />

          <div className="lc-archive__inner">
            <div className="container">
              <header className="lc-head">
                <span className="lc-head__label">The Archive</span>
                <h2 className="lc-head__title">Selected matters,<br />anonymised.</h2>
                <p className="lc-head__note">
                  Six representative files, drawn across the firm’s practice areas. Names, citations
                  and party details are withheld — the shape of the matter is the point.
                </p>
                <span className="lc-head__rule" aria-hidden="true" />
              </header>

              <CaseDossier cases={landmarkCases} />

              <p className="lc-foot-note">{disclaimer}</p>
            </div>
          </div>
        </section>
      </div>

      <Consult />
    </Layout>
  );
}
