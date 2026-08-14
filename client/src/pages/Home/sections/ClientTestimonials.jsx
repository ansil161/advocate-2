import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useInView,
  useMotionTemplate,
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

// Per-column drift speed (px/s) and direction. -1 travels up, 1 travels down —
// alternating them gives the wall a slow counter-rotation instead of one flat slab.
const LANES = [
  { speed: 26, direction: -1 },
  { speed: 34, direction: 1 },
  { speed: 21, direction: -1 },
];

// Modular wrap — keeps the column's y inside one set-height so the loop is seamless.
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

// Column count is resolved in JS rather than by hiding columns in CSS: hiding them
// would drop those testimonials off small screens entirely. Here every quote is
// redistributed into whatever lanes are actually on screen.
function useLaneCount() {
  const [count, setCount] = useState(() => {
    if (typeof window === 'undefined') return 3;
    if (window.matchMedia('(min-width: 1024px)').matches) return 3;
    if (window.matchMedia('(min-width: 680px)').matches) return 2;
    return 1;
  });

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)');
    const mid = window.matchMedia('(min-width: 680px)');
    const sync = () => setCount(wide.matches ? 3 : mid.matches ? 2 : 1);
    sync();
    wide.addEventListener('change', sync);
    mid.addEventListener('change', sync);
    return () => {
      wide.removeEventListener('change', sync);
      mid.removeEventListener('change', sync);
    };
  }, []);

  return count;
}

function Card({ item }) {
  return (
    <article className="testi-card">
      <span className="testi-card__mark" aria-hidden="true">
        &ldquo;
      </span>
      <blockquote className="testi-card__quote">{item.quote}</blockquote>
      <footer className="testi-card__foot">
        <span className="testi-card__seal" aria-hidden="true">
          {initials(item.name)}
        </span>
        <span className="testi-card__who">
          <cite className="testi-card__name">{item.name}</cite>
          <span className="testi-card__meta">{item.meta}</span>
        </span>
      </footer>
    </article>
  );
}

function Lane({ items, lane, index, revealed, reduced }) {
  const laneRef = useRef(null);
  const setRef = useRef(null);
  const hovering = useRef(false);
  const current = useRef(0); // eased speed, so the lane starts and stops without a jolt
  const placed = useRef(false);
  const y = useMotionValue(0);
  const [setHeight, setSetHeight] = useState(0);
  // The track holds `copies` identical sets. y is wrapped into [-setHeight, 0], so the
  // track must span at least one set beyond the lane or the trailing edge shows a gap.
  const [copies, setCopies] = useState(2);

  // Scroll velocity feeds back into the drift: scroll hard and the wall surges with you.
  const { scrollY } = useScroll();
  const rawVelocity = useVelocity(scrollY);
  const velocity = useSpring(rawVelocity, { damping: 46, stiffness: 380, mass: 0.4 });
  const boost = useTransform(velocity, [-2400, 0, 2400], [-1.8, 0, 1.8], { clamp: true });

  useLayoutEffect(() => {
    const el = setRef.current;
    if (!el) return undefined;
    const measure = () => {
      const h = el.scrollHeight;
      if (!h) return;
      setSetHeight(h);
      const viewport = laneRef.current?.offsetHeight || window.innerHeight;
      setCopies(Math.max(2, Math.ceil(viewport / h) + 1));
      // A downward lane climbs from -setHeight to 0; starting it at 0 would wrap on
      // the very first frame. Seed it at the top of the window instead.
      if (!placed.current) {
        placed.current = true;
        y.set(lane.direction > 0 ? -h : 0);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [lane.direction, y]);

  useAnimationFrame((_, deltaMs) => {
    if (!setHeight || reduced || !revealed) return;
    const dt = Math.min(deltaMs, 48) / 1000;
    // Ramp toward target speed — slows (never stops) on hover so a quote stays readable.
    const target = hovering.current ? lane.speed * 0.12 : lane.speed;
    current.current += (target - current.current) * Math.min(1, dt * 2.4);
    const step = lane.direction * current.current * dt;
    y.set(wrap(-setHeight, 0, y.get() + step + step * boost.get()));
  });

  return (
    <motion.div
      className="testi-lane"
      ref={laneRef}
      onMouseEnter={() => {
        hovering.current = true;
      }}
      onMouseLeave={() => {
        hovering.current = false;
      }}
      initial={false}
      animate={
        revealed || reduced
          ? { opacity: 1, y: 0, rotate: 0 }
          : { opacity: 0, y: 64, rotate: index % 2 === 0 ? -1.4 : 1.4 }
      }
      transition={
        reduced ? { duration: 0.01 } : { duration: 1.15, ease: EASE, delay: 0.16 + index * 0.12 }
      }
    >
      <motion.div className="testi-lane__track" style={{ y }}>
        {Array.from({ length: copies }, (_, copy) => (
          <div
            className="testi-lane__set"
            key={copy}
            ref={copy === 0 ? setRef : null}
            aria-hidden={copy > 0 ? 'true' : undefined}
          >
            {items.map((item, i) => (
              <Card key={`${copy}-${i}`} item={item} />
            ))}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// The section only exists when there is something true to put in it. Guarding
// here rather than inside the wall keeps it clear of the hooks below — and means
// the whole choreography stays exactly as written, ready for the moment
// data/testimonials.js has genuine, consented entries in it.
export default function ClientTestimonials() {
  if (!testimonials.length) return null;
  return <TestimonialsWall />;
}

function TestimonialsWall() {
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: '-14% 0px -14% 0px' });
  const reduced = useReducedMotion();
  const laneCount = useLaneCount();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) {
      setRevealed(true);
      return undefined;
    }
    // Hold a beat after the headline lands, then let the wall arrive.
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  // Round-robin so adjacent lanes never carry consecutive quotes.
  const lanes = useMemo(() => {
    const buckets = Array.from({ length: laneCount }, () => []);
    testimonials.forEach((item, i) => buckets[i % laneCount].push(item));
    return buckets;
  }, [laneCount]);

  // One scroll pass drives the whole section: the wall builds on approach, holds
  // through the middle, then recedes as it leaves — so the exit is authored too,
  // not just whatever the scroll happens to leave on screen.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const arc = [0, 0.22, 0.76, 1];
  const stageY = useTransform(scrollYProgress, arc, [80, 0, 0, -72]);
  const stageScale = useTransform(scrollYProgress, arc, [0.945, 1, 1, 0.965]);
  const stageRotate = useTransform(scrollYProgress, arc, [7, 0, 0, -5.5]);
  const stageOpacity = useTransform(scrollYProgress, arc, [0, 1, 1, 0]);
  const stageBlurPx = useTransform(scrollYProgress, arc, [12, 0, 0, 9]);
  const stageBlur = useMotionTemplate`blur(${stageBlurPx}px)`;
  const headY = useTransform(scrollYProgress, arc, [46, 0, 0, -38]);
  const headOpacity = useTransform(scrollYProgress, arc, [0.15, 1, 1, 0.08]);
  const glowOpacity = useTransform(scrollYProgress, arc, [0.15, 1, 1, 0.12]);

  const stageStyle = reduced
    ? undefined
    : {
        y: stageY,
        scale: stageScale,
        rotateX: stageRotate,
        opacity: stageOpacity,
        filter: stageBlur,
      };
  const headStyle = reduced ? undefined : { y: headY, opacity: headOpacity };

  return (
    <section className="testimonials" id="testimonials" ref={sectionRef}>
      <div className="testimonials__bg" aria-hidden="true">
        <img src={libraryImg} alt="" />
      </div>
      <motion.div
        className="testimonials__ambience"
        aria-hidden="true"
        style={reduced ? undefined : { opacity: glowOpacity }}
      />
      <div className="testimonials__grain" aria-hidden="true" />

      <motion.div className="container testimonials__head" style={headStyle}>
        <div className="testimonials__headline">
          <span className="eyebrow eyebrow--light">
            <SplitText text="Client Experience" />
          </span>
          <h2 className="h2 h2--light">
            <SplitText text="What working with SLA" as="div" />
            <SplitText text="looks like." as="div" />
          </h2>
        </div>
        <div className="testimonials__aside">
          <motion.span
            className="testimonials__hair"
            aria-hidden="true"
            initial={false}
            animate={{ scaleX: revealed || reduced ? 1 : 0 }}
            transition={reduced ? { duration: 0.01 } : { duration: 1.3, ease: EASE }}
          />
          <p className="testimonials__note">
            How the work reads from the other side of the table — the brief, the bench, and every
            date in between.
          </p>
        </div>
      </motion.div>

      <div className="testi-band">
        <motion.div className="testi-stage" style={stageStyle}>
          {lanes.map((items, i) => (
            <Lane
              key={`${laneCount}-${i}`}
              items={items}
              lane={LANES[i % LANES.length]}
              index={i}
              revealed={revealed}
              reduced={reduced}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
