import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { stats } from '../../../data/firm.js';
import { milestones, credentials } from '../../../data/awards.js';
import { practiceAreas } from '../../../data/practiceAreas.js';
import foundationImg from '../../../assets/img/hero-courthouse.webp';
import experienceImg from '../../../assets/img/columns-abstract.webp';
import practiceImg from '../../../assets/img/bookshelf-mono.webp';
import benchImg from '../../../assets/img/colonnade-diagonal.webp';
import todayImg from '../../../assets/img/about-colonnade.webp';

gsap.registerPlugin(ScrollTrigger);

const barCouncilNo = credentials.find((c) => c.display)?.display ?? 'TS/286/1996';

// One fixed centered stage (position: sticky, not a GSAP pin — no pin-spacer, no
// pin-related layout fragility). Every beat — a bare statement or a photo card —
// shares that exact same slot and centered anchor; scroll only cross-fades which
// one currently occupies it. Cards carry a fixed 4:3 image, never a variable one.
// All content is sourced from data/firm.js, data/awards.js, data/practiceAreas.js.
const BEATS = [
  {
    type: 'statement',
    kicker: 'Hyderabad',
    title: ['Three decades', 'at the Bar.'],
    body: `Sridhar Lendalay's ${stats[0].value}${stats[0].suffix}-year career at the Bar is the foundation SLA Advocates was built on.`,
  },
  {
    type: 'card',
    img: foundationImg,
    year: milestones[0].year,
    title: 'Called to the Bar',
    body: milestones[0].body,
    meta: `Bar Council of Telangana — ${barCouncilNo}`,
  },
  {
    type: 'card',
    img: experienceImg,
    year: `${stats[0].value}${stats[0].suffix}`,
    title: 'Years at the Bar',
    body: 'Every matter carries the same personal oversight — from strategy at intake to the final execution proceeding.',
  },
  {
    type: 'card',
    img: practiceImg,
    year: String(practiceAreas.length),
    title: 'Disciplines. One standard.',
    body: 'Civil, criminal, constitutional, banking and corporate matters — argued with the same rigor, under one roof.',
  },
  {
    type: 'card',
    img: benchImg,
    year: '11',
    title: `Advocates, ${stats[3].value}${stats[3].suffix} years combined`,
    body: 'A full bench across civil, criminal, banking and constitutional practice — no matter handed off and forgotten.',
  },
  {
    type: 'card',
    img: todayImg,
    year: `${stats[1].value}${stats[1].suffix}`,
    title: `Cases handled, ${stats[2].value}${stats[2].suffix} success`,
    body: milestones[5].body,
  },
  {
    type: 'statement',
    kicker: 'What comes next',
    title: ['A judgment is only', 'as good as its execution.'],
    body: 'Thirty years of practice. Eleven advocates. One standard that hasn’t moved.',
  },
];

const N = BEATS.length;

export default function StorySection() {
  const sectionRef = useRef(null);
  const beatRefs = useRef([]);
  const threadGlowRef = useRef(null);
  const threadCoreRef = useRef(null);

  useLayoutEffect(() => {
    let live = true;

    // ScrollTrigger measures start/end once and refreshes on `window.load`.
    // Arriving here from another route is a client-side navigation, so that
    // event fired long ago — yet the hero and stat band above this section are
    // still settling as their webfonts swap in, which moves the section and
    // leaves every beat mapped to the wrong scroll position. One refresh once
    // the fonts have resolved puts the measurements back on the real layout.
    document.fonts?.ready.then(() => {
      if (live) ScrollTrigger.refresh();
    });

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          cinematic: '(min-width: 861px) and (prefers-reduced-motion: no-preference)',
          reduced: '(max-width: 860px), (prefers-reduced-motion: reduce)',
        },
        (context) => {
          if (context.conditions.cinematic) return buildCinematic();
          return buildFallback();
        }
      );

      function buildCinematic() {
        const beats = beatRefs.current.filter(Boolean);
        const thread = [threadGlowRef.current, threadCoreRef.current].filter(Boolean);
        const threadLen = thread[0] ? thread[0].getTotalLength() : 0;

        gsap.set(beats, { autoAlpha: 0, scale: 0.92, y: 26, filter: 'blur(6px)' });
        gsap.set(beats[0], { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)' });
        if (thread.length) gsap.set(thread, { strokeDasharray: threadLen, strokeDashoffset: threadLen });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top top',
            end: 'bottom bottom',
            // 1s of smoothing let a fast flick outrun the timeline by a whole
            // beat or more, so the cards in the middle of the sequence were
            // never reaching full opacity before the scroll had moved on.
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        });

        if (thread.length) {
          tl.to(thread, { strokeDashoffset: 0, duration: N - 1, ease: 'none' }, 0);
        }

        // One timeline unit per beat. Of that unit, the cross-fades take 0.3 at
        // each end and the beat holds fully opaque for the 0.67 between — the
        // hold has to be the majority of the unit, or the sequence reads as a
        // continuous blur with nothing legible in it.
        const FADE = 0.3;
        beats.forEach((el, i) => {
          const at = i;
          if (i > 0) {
            tl.to(el, { autoAlpha: 1, scale: 1, y: 0, filter: 'blur(0px)', duration: FADE, ease: 'power2.out' }, at - 0.42);
          }
          if (i < N - 1) {
            tl.to(el, { autoAlpha: 0, scale: 1.06, y: -22, filter: 'blur(6px)', duration: FADE, ease: 'power2.in' }, at + 0.55);
          }
        });
      }

      function buildFallback() {
        const beats = beatRefs.current.filter(Boolean);
        beats.forEach((el) => {
          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 22 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.8,
              ease: 'power2.out',
              scrollTrigger: { trigger: el, start: 'top 82%', toggleActions: 'play none none reverse' },
            }
          );
        });
      }
    }, sectionRef);

    return () => {
      live = false;
      ctx.revert();
    };
  }, []);

  return (
    <section className="story" id="a-story" ref={sectionRef}>
      <div className="story__scroll">
        <div className="story__stage">
          <div className="story__grain" aria-hidden="true" />

          <svg className="story__thread" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path
              ref={threadGlowRef}
              className="story__thread-path story__thread-path--glow"
              d="M 50 3 C 20 18, 78 34, 50 50 S 22 82, 50 97"
              vectorEffect="non-scaling-stroke"
            />
            <path
              ref={threadCoreRef}
              className="story__thread-path story__thread-path--core"
              d="M 50 3 C 20 18, 78 34, 50 50 S 22 82, 50 97"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="story__beats">
            {BEATS.map((b, i) =>
              b.type === 'statement' ? (
                <div className="story__beat" key={i} ref={(el) => (beatRefs.current[i] = el)}>
                  <div className="story__statement">
                    <span className="story__kicker">{b.kicker}</span>
                    <h3 className="story__statement-title">
                      {b.title.map((line, li) => (
                        <span className="story__title-line" key={li}>{line}</span>
                      ))}
                    </h3>
                    <p className="story__statement-body">{b.body}</p>
                  </div>
                </div>
              ) : (
                <div className="story__beat" key={i} ref={(el) => (beatRefs.current[i] = el)}>
                  <div className="story__card">
                    <div className="story__card-media">
                      {/* Never `loading="lazy"`. Every beat but the first sits
                          at `visibility: hidden` until the scrub fades it in,
                          and a lazy image inside a hidden subtree is not
                          eligible to load — so all but one card arrived at its
                          cue with nothing in the window. They load with the
                          page instead. */}
                      <img src={b.img} alt="" decoding="async" />
                    </div>
                    <div className="story__card-text">
                      <span className="story__year">{b.year}</span>
                      <h4 className="story__card-title">{b.title}</h4>
                      <p className="story__card-body">{b.body}</p>
                      {b.meta && <span className="story__card-meta">{b.meta}</span>}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
