import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import { testimonials } from '../../../data/testimonials.js';
import libraryImg from '../../../assets/img/library-moody.webp';

const EASE = [0.16, 1, 0.3, 1];

// Modular wrap — keeps the track's x inside one set-width so the loop is seamless.
function wrap(min, max, value) {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function initials(name) {
  return name
    .split(' ')
    .filter((p) => p.length > 1)
    .slice(0, 2)
    .map((p) => p[0])
    .join('');
}

function Card({ item, index, revealed, delay, reduced }) {
  return (
    <motion.article
      className="testi-card"
      initial={false}
      animate={
        revealed || reduced
          ? { opacity: 1, y: 0, rotateX: 0, scale: 1 }
          : { opacity: 0, y: 56, rotateX: -18, scale: 0.94 }
      }
      transition={
        reduced
          ? { duration: 0.01 }
          : { duration: 1.05, ease: EASE, delay: revealed ? delay + index * 0.07 : 0 }
      }
    >
      <span className="testi-card__mark" aria-hidden="true">
        &ldquo;
      </span>
      <p className="testi-card__quote">{item.quote}</p>
      <footer className="testi-card__foot">
        <span className="testi-card__mono" aria-hidden="true">
          {initials(item.name)}
        </span>
        <span className="testi-card__who">
          <b className="testi-card__name">{item.name}</b>
          <em className="testi-card__meta">{item.meta}</em>
        </span>
      </footer>
    </motion.article>
  );
}

function MarqueeRow({ items, direction, speed, revealed, delay, reduced }) {
  const rowRef = useRef(null);
  const setRef = useRef(null);
  const hovering = useRef(false);
  const current = useRef(0); // eased speed, so the row starts and stops without a jolt
  const placed = useRef(false);
  const x = useMotionValue(0);
  const [setWidth, setSetWidth] = useState(0);
  // The track holds `copies` identical sets. x is wrapped into [-setWidth, 0], so the
  // track must span at least one set beyond the viewport or the tail edge shows a gap.
  const [copies, setCopies] = useState(2);

  // Scroll velocity feeds back into the marquee: scroll fast and the rows surge and lean.
  const { scrollY } = useScroll();
  const rawVelocity = useVelocity(scrollY);
  const velocity = useSpring(rawVelocity, { damping: 46, stiffness: 380, mass: 0.4 });
  const boost = useTransform(velocity, [-2400, 0, 2400], [-2.6, 0, 2.6], { clamp: true });
  const lean = useTransform(velocity, [-2400, 0, 2400], [2.5, 0, -2.5], { clamp: true });

  useLayoutEffect(() => {
    const el = setRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.scrollWidth;
      if (!w) return;
      setSetWidth(w);
      const viewport = rowRef.current?.offsetWidth || window.innerWidth;
      setCopies(Math.max(2, Math.ceil(viewport / w) + 1));
      // A rightward row climbs from -setWidth to 0; starting it at 0 would wrap on
      // the very first frame. Seed it at the bottom of the window instead.
      if (!placed.current) {
        placed.current = true;
        x.set(direction > 0 ? -w : 0);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [direction, x]);

  useAnimationFrame((_, deltaMs) => {
    if (!setWidth || reduced || !revealed) return;
    const dt = Math.min(deltaMs, 48) / 1000;
    // Ramp toward target speed — slows (never stops) on hover so text stays readable.
    const target = hovering.current ? speed * 0.15 : speed;
    current.current += (target - current.current) * Math.min(1, dt * 2.4);
    const step = direction * current.current * dt;
    x.set(wrap(-setWidth, 0, x.get() + step + step * boost.get()));
  });

  return (
    <div
      className="testi-row"
      ref={rowRef}
      onMouseEnter={() => {
        hovering.current = true;
      }}
      onMouseLeave={() => {
        hovering.current = false;
      }}
    >
      <motion.div
        className="testi-row__track"
        style={{ x, skewX: reduced ? 0 : lean }}
        initial={false}
        animate={{ filter: revealed || reduced ? 'blur(0px)' : 'blur(14px)' }}
        transition={reduced ? { duration: 0.01 } : { duration: 1.2, ease: EASE, delay }}
      >
        {Array.from({ length: copies }, (_, copy) => (
          <div
            className="testi-row__set"
            key={copy}
            ref={copy === 0 ? setRef : null}
            aria-hidden={copy > 0 ? 'true' : undefined}
          >
            {items.map((item, i) => (
              <Card
                key={`${copy}-${i}`}
                item={item}
                index={i}
                revealed={revealed}
                delay={delay}
                reduced={reduced}
              />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function ClientTestimonials() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: '-18% 0px -18% 0px' });
  const reduced = useReducedMotion();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) {
      setRevealed(true);
      return undefined;
    }
    // Hold a beat after the headline lands, then let the band arrive.
    const t = setTimeout(() => setRevealed(true), 320);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  const rowA = testimonials.filter((_, i) => i % 2 === 0);
  const rowB = testimonials.filter((_, i) => i % 2 === 1);

  return (
    <section className="testimonials" id="testimonials" ref={sectionRef}>
      <div className="testimonials__bg" aria-hidden="true">
        <img src={libraryImg} alt="" />
      </div>
      <div className="testimonials__ambience" aria-hidden="true" />

      <div className="container testimonials__head">
        <span className="eyebrow eyebrow--light">
          <SplitText text="Client Experience" />
        </span>
        <h2 className="h2 h2--light">
          <SplitText text="What working with SLA" as="div" />
          <SplitText text="looks like." as="div" />
        </h2>
      </div>

      <div className="testi-band">
        <motion.span
          className="testi-band__rule"
          aria-hidden="true"
          initial={false}
          animate={{ scaleX: revealed || reduced ? 1 : 0, opacity: revealed || reduced ? 1 : 0 }}
          transition={reduced ? { duration: 0.01 } : { duration: 1.4, ease: EASE }}
        />

        <MarqueeRow
          items={rowA}
          direction={1}
          speed={46}
          revealed={revealed}
          delay={0.18}
          reduced={reduced}
        />
        <MarqueeRow
          items={rowB}
          direction={-1}
          speed={38}
          revealed={revealed}
          delay={0.34}
          reduced={reduced}
        />

        <motion.span
          className="testi-band__rule testi-band__rule--end"
          aria-hidden="true"
          initial={false}
          animate={{ scaleX: revealed || reduced ? 1 : 0, opacity: revealed || reduced ? 1 : 0 }}
          transition={reduced ? { duration: 0.01 } : { duration: 1.4, ease: EASE, delay: 0.2 }}
        />
      </div>
    </section>
  );
}
