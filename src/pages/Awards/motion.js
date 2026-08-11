import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// ONE motion language for the whole Awards page.
//
// Every section imports from here rather than hand-rolling its own easing and
// distances, so the page reads as a single editorial journey instead of seven
// separate animations. The vocabulary is deliberately small:
//
//   rise()      — type and figures enter: opacity 0 → 1, y 40 → 0
//   drawRule()  — hairlines draw left → right: scaleX 0 → 1
//   settle()    — years and marks arrive: scale 0.96 → 1 with the rise
//
// No bounce, no elastic, no rotation, no flips. Nothing moves further than 48px.
export const EASE = 'power2.out';
export const DUR = 1.05;

export const MQ = {
  // Reveals run everywhere motion is welcome, phone included.
  motion: '(prefers-reduced-motion: no-preference)',
  // Parallax, sticky columns and scrubbed camera moves are desktop-only —
  // mobile keeps the typography and drops the simultaneous layers.
  cinematic: '(min-width: 861px) and (prefers-reduced-motion: no-preference)',
};

// Scroll-triggered entrance. `from` tweens are used on purpose: if JS never runs,
// the markup stays visible and readable rather than stranded at opacity 0.
export function rise(targets, { trigger, start = 'top 84%', y = 40, stagger = 0.08, delay = 0, duration = DUR } = {}) {
  return gsap.from(targets, {
    autoAlpha: 0,
    y,
    duration,
    delay,
    stagger,
    ease: EASE,
    scrollTrigger: { trigger: trigger || targets, start, once: true },
  });
}

export function drawRule(targets, { trigger, start = 'top 88%', duration = 1.2, stagger = 0.08 } = {}) {
  return gsap.from(targets, {
    scaleX: 0,
    duration,
    stagger,
    ease: EASE,
    scrollTrigger: { trigger: trigger || targets, start, once: true },
  });
}

export function settle(targets, { trigger, start = 'top 82%', y = 44, duration = 1.2, stagger = 0 } = {}) {
  return gsap.from(targets, {
    autoAlpha: 0,
    y,
    scale: 0.96,
    duration,
    stagger,
    ease: EASE,
    transformOrigin: 'left bottom',
    scrollTrigger: { trigger: trigger || targets, start, once: true },
  });
}
