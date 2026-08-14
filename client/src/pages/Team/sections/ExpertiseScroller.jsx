import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Icon, { practiceIcon } from '../../../components/ui/Icon.jsx';
import { chamberImage } from '../../PracticeAreas/lib/practiceImagery.js';

gsap.registerPlugin(ScrollTrigger);

// ============================================================
//  EXPERTISE MAP
// ------------------------------------------------------------
//  The domains as an index that is *read*, not a strip that is dragged past.
//
//  Left: twelve ruled rows, each arriving on its own — the rule draws in from
//  the left, then the mark, the name and the forum rise out of a blur behind it.
//  Right: one specimen plate, held sticky, that belongs to whichever row is
//  currently crossing the reading line at 58% of the viewport. The plate is a
//  photograph of the institution the domain is heard in, with the domain's mark
//  struck into its lower corner. Neither is cross-faded lazily: the photograph
//  dissolves out of a slow push-in, and the mark is re-drawn stroke by stroke
//  every time the reading line moves. That redraw is the section's whole idea —
//  the bench works one matter at a time, and the plate shows the one you are on.
//
//  The section also opens and closes. It is armed only when it arrives (the
//  spine draws down, the plate rises, the first mark is struck as you get
//  there rather than silently before), and as it is left behind the plate lifts
//  away, the index recedes and the spine retracts from the bottom.
//
//  The plate is deliberately *not* a card. No border box, no corner brackets,
//  no chip pills, no glow — those read as a product template, and this is a
//  litigation bench. It is set the way a printed brief is set: a column rule,
//  a struck mark, a heading, a paragraph at a real measure, and the forums as
//  a ruled schedule. Everything that distinguishes a row or the plate is type,
//  rule, photograph or gold — never a filled box.
// ============================================================

const EASE = 'power3.out';
const DESKTOP = '(min-width: 861px) and (prefers-reduced-motion: no-preference)';
const MOTION = '(prefers-reduced-motion: no-preference)';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function ExpertiseScroller({ items }) {
  const rootRef = useRef(null);
  const rowRefs = useRef([]);
  const photoRefs = useRef({});
  const markRef = useRef(null);
  const capRef = useRef(null);

  // Scroll owns the reading position; the pointer temporarily overrides it.
  const [read, setRead] = useState(0);
  const [hover, setHover] = useState(null);
  // Nothing on the plate plays until the section has actually arrived — except
  // under reduced motion, where there is no arrival to wait for.
  const [armed, setArmed] = useState(prefersReduced);

  const active = hover ?? read;
  const p = items[active];

  // Four institutional plates cover twelve domains, and the same domain resolves
  // to the same plate here as it does on its own practice page.
  const plates = useMemo(
    () => [...new Set(items.map((it) => chamberImage(it.slug).src))],
    [items],
  );

  const setRow = useCallback((el, i) => {
    rowRefs.current[i] = el;
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // ---- arrival: every row builds itself once, in reading order --------
      mm.add(MOTION, () => {
        rowRefs.current.forEach((row) => {
          if (!row) return;
          const tl = gsap.timeline({
            scrollTrigger: { trigger: row, start: 'top 88%', once: true },
            defaults: { ease: EASE },
          });
          tl.from(row.querySelector('.t-xmap__rule'), { scaleX: 0, duration: 1.15 })
            .from(
              row.querySelectorAll('.t-xmap__mark, .t-xmap__name, .t-xmap__forum'),
              { autoAlpha: 0, y: 28, filter: 'blur(6px)', duration: 0.95, stagger: 0.07 },
              0.12,
            );
        });

        // ---- the section opens ---------------------------------------------
        const open = gsap.timeline({
          scrollTrigger: { trigger: rootRef.current, start: 'top 78%', once: true },
          defaults: { ease: EASE },
        });
        open
          .from('.t-xmap__spine', { scaleY: 0, transformOrigin: 'top', duration: 1.3 }, 0)
          .from('.t-xmap__plate', { autoAlpha: 0, y: 44, duration: 1.15 }, 0.15);
      });

      // ---- the reading line ------------------------------------------------
      mm.add(DESKTOP, () => {
        rowRefs.current.forEach((row, i) => {
          if (!row) return;
          ScrollTrigger.create({
            trigger: row,
            start: 'top 58%',
            end: 'bottom 58%',
            onToggle: (self) => {
              if (self.isActive) setRead(i);
            },
          });
        });

        // ---- and closes ------------------------------------------------------
        // Scrubbed, and only once the last row is behind the reader: the plate
        // lifts away, the index recedes rather than disappearing, and the spine
        // retracts from the foot — the reverse of how it drew in.
        gsap
          .timeline({
            scrollTrigger: {
              trigger: rootRef.current,
              start: 'bottom 62%',
              end: 'bottom 8%',
              scrub: 0.6,
            },
          })
          .to('.t-xmap__plate', { autoAlpha: 0, y: -52, ease: 'power2.in' }, 0)
          .to('.t-xmap__list', { opacity: 0.32, y: -18, ease: 'none' }, 0)
          .to('.t-xmap__spine', { scaleY: 0, transformOrigin: 'bottom', ease: 'none' }, 0);
      });
    }, rootRef);

    return () => ctx.revert();
  }, [items]);

  // Arming decides whether the plate has any content on it at all, so it is
  // measured directly rather than hung off ScrollTrigger or an
  // IntersectionObserver. Both of those are serviced by the rendering
  // lifecycle, which a throttled or backgrounded tab can starve indefinitely;
  // a passive scroll listener plus `getBoundingClientRect` cannot be starved,
  // and the check is one rect read against a boolean that latches once.
  useEffect(() => {
    if (armed) return undefined;
    const el = rootRef.current;
    if (!el) return undefined;

    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.78 && r.bottom > 0) {
        setArmed(true);
        return true;
      }
      return false;
    };
    if (check()) return undefined;

    const onScroll = () => {
      if (check()) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [armed]);

  // ---- the photograph changes with the reading line -----------------------
  // The dissolve itself is a CSS transition driven by React state, not a tween:
  // whether the plate has a picture on it at all must not depend on an
  // animation loop having run. GSAP only adds the push-in behind it, which is
  // decorative and safe to lose.
  const activeSrc = chamberImage(p.slug).src;

  useEffect(() => {
    if (!armed) return;
    // The plates are `loading="lazy"`, which is right for a section this far
    // down the page — but the lazy heuristic is the browser's to decide, and a
    // plate that arrives late shows as an empty frame. Asking for the bytes
    // directly the moment a domain becomes active takes that out of its hands.
    const warm = new Image();
    warm.src = activeSrc;

    if (prefersReduced()) return;
    const on = photoRefs.current[activeSrc];
    if (!on) return;
    gsap.fromTo(on, { scale: 1.07 }, { scale: 1, duration: 1.9, ease: 'power2.out', overwrite: 'auto' });
  }, [activeSrc, armed]);

  // ---- the mark is re-struck for each new domain --------------------------
  // Not a cross-fade: the strokes are dashed to their own length and paid back
  // out, so the mark is drafted in front of the reader. `getTotalLength` is on
  // SVGGeometryElement, which covers every shape the icon set uses.
  useEffect(() => {
    if (!armed) return undefined;
    const svg = markRef.current?.querySelector('svg');
    if (!svg || prefersReduced()) return undefined;

    const geo = Array.from(svg.querySelectorAll('path, circle, ellipse, rect, line'));
    const drawable = geo.filter((el) => typeof el.getTotalLength === 'function' && el.getTotalLength() > 0);
    drawable.forEach((el) => {
      const len = el.getTotalLength();
      gsap.set(el, { strokeDasharray: len, strokeDashoffset: len });
    });

    const tl = gsap.timeline();
    tl.fromTo(svg, { autoAlpha: 0.15, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.55, ease: EASE }, 0)
      .to(drawable, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.075 }, 0)
      .fromTo(
        capRef.current?.children ?? [],
        { autoAlpha: 0, y: 16, filter: 'blur(5px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: EASE, stagger: 0.05 },
        0.1,
      );

    return () => {
      tl.kill();
      gsap.set(drawable, { clearProps: 'strokeDasharray,strokeDashoffset' });
    };
  }, [p.slug, armed]);

  return (
    <div className="t-xmap" ref={rootRef}>
      <div className="container t-xmap__inner">
        <ol className="t-xmap__list">
          {items.map((item, i) => (
            <li
              key={item.slug}
              ref={(el) => setRow(el, i)}
              className={`t-xmap__row ${i === active ? 'is-active' : ''}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            >
              <Link to={`/practice/${item.slug}`} className="t-xmap__link" onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                <span className="t-xmap__rule" aria-hidden="true" />
                <span className="t-xmap__edge" aria-hidden="true" />
                <span className="t-xmap__mark">
                  <Icon name={practiceIcon(item.slug)} />
                </span>
                <span className="t-xmap__body">
                  <span className="t-xmap__name">{item.title}</span>
                  {/* Present at every width. On desktop it is the plate's job;
                      under 1080px the plate is gone, so this is the only thing
                      carrying the domain's substance. */}
                  <span className="t-xmap__short">{item.short}</span>
                </span>
                <span className="t-xmap__forum">{item.forums[0]}</span>
                <span className="t-xmap__go" aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </ol>

        <aside className="t-xmap__aside" aria-hidden="true">
          <span className="t-xmap__spine" />
          <div className="t-xmap__plate">
            <figure className="t-xmap__well">
              {plates.map((src) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="t-xmap__photo"
                  style={{ opacity: armed && src === activeSrc ? 1 : 0 }}
                  ref={(el) => {
                    photoRefs.current[src] = el;
                  }}
                />
              ))}
              <span className="t-xmap__wash" />
              <span className="t-xmap__mark-well" ref={markRef} key={p.slug}>
                <Icon name={practiceIcon(p.slug)} className="t-xmap__mark-big" />
              </span>
            </figure>

            <div className="t-xmap__cap" ref={capRef}>
              <span className="t-xmap__cap-eyebrow">Domain</span>
              <h3 className="t-xmap__cap-name">{p.title}</h3>
              <p className="t-xmap__cap-short">{p.short}</p>
              <span className="t-xmap__cap-label">Heard before</span>
              <ul className="t-xmap__cap-forums">
                {p.forums.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
