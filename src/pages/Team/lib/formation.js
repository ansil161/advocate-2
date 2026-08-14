// Placement data for the Team hero group portrait.
//
// The bench was never photographed together, so the hero *stages* the group
// photograph instead: eleven separate cut-outs stood in a wedge in front of a
// panelled library wall, the founder front and centre and the rest fanning
// back either side of him in five receding ranks.
//
// The geometry rides on top of lineup.js, which already carries each cut-out's
// own measurements in head-widths (w/h/crown/cx/l/r). This file adds only where
// a figure stands:
//
//   rank   0 = front and centre, 5 = furthest back. Drives z-order and grade.
//   d      depth scale. Every dimension the figure has is multiplied by it, so
//          a rank-5 advocate is literally a smaller print of the same person.
//   fx     horizontal position of the *head centre*, in front-rank head-widths
//          out from the centre line. Negative is stage left.
//   dy     a few hundredths of a head of vertical jitter, so eleven people do
//          not stand on a suspiciously perfect curve.
//   fade   where the figure's bottom fade begins, as a % of its own height.
//
// `fx` is not spacing — it is packing. Each figure claims the shoulder width
// lineup.js measured for it (l/r, scaled by d), and the values below are chosen
// so every advocate's shoulder overlaps their neighbour's by roughly half a
// head. Evenly spaced heads leave holes, because several of the sources frame
// their subject hard to one side of the frame.
//
// Ranks follow standing at the bar: the founder, then the senior advocate and
// the firm's longest-serving advocate, then the associates, then the juniors.
// Re-measure lineup.js if a portrait is replaced; adjust only `fx` here.
import { figureFor } from './lineup.js';

const PLACEMENT = [
  { slug: 'sridhar-lendalay', rank: 0, d: 1.0, fx: 0, dy: 0, fade: 96 },

  { slug: 'palanati-lakshman', rank: 1, d: 0.86, fx: -1.62, dy: 0.03, fade: 84 },
  { slug: 'tv-arvind', rank: 1, d: 0.86, fx: 1.66, dy: -0.02, fade: 84 },

  { slug: 'manjula-lendalay', rank: 2, d: 0.76, fx: -2.98, dy: 0.04, fade: 76 },
  { slug: 'ashok-kumar-shetty', rank: 2, d: 0.76, fx: 3.02, dy: -0.03, fade: 76 },

  { slug: 'vinesh-lendalay', rank: 3, d: 0.67, fx: -4.1, dy: 0.02, fade: 70 },
  { slug: 'beemanaboina-krupakar', rank: 3, d: 0.67, fx: 4.15, dy: -0.04, fade: 70 },

  { slug: 'akshay-kumar-nakka', rank: 4, d: 0.59, fx: -5.05, dy: 0.03, fade: 66 },
  { slug: 'karthik-yadav', rank: 4, d: 0.59, fx: 5.1, dy: -0.02, fade: 66 },

  { slug: 'pavan-gajjela', rank: 5, d: 0.52, fx: -5.85, dy: 0.03, fade: 62 },
  { slug: 'bharath-raj-lendalay', rank: 5, d: 0.52, fx: 5.9, dy: -0.03, fade: 62 },
];

/** Widest point of the wedge, in front-rank head-widths — the stage's width. */
export const SPAN = PLACEMENT.reduce((max, p) => {
  const f = figureFor(p.slug);
  if (!f) return max;
  return Math.max(max, Math.abs(p.fx) + Math.max(f.l, f.r) * p.d);
}, 0) * 2;

/** Furthest rank in the wedge — the entrance plays back-to-front off this. */
export const RANKS = PLACEMENT.reduce((max, p) => Math.max(max, p.rank), 0);

const BY_SLUG = Object.fromEntries(PLACEMENT.map((p) => [p.slug, p]));

export function placementFor(slug) {
  return BY_SLUG[slug] || null;
}

/**
 * Every custom property one figure needs. The CSS does the arithmetic, so the
 * whole group rescales off `--head` alone and a resize costs no JavaScript.
 */
export function figureVars(slug) {
  const f = figureFor(slug);
  const p = BY_SLUG[slug];
  if (!f || !p) return undefined;
  return {
    '--fig-w': f.w,
    '--fig-h': f.h,
    '--fig-crown': f.crown,
    '--fig-cx': f.cx,
    '--rank': p.rank,
    '--d': p.d,
    '--fx': p.fx,
    '--dy': p.dy,
    '--fade': `${p.fade}%`,
    // Masks the tint layer to the figure's own silhouette — the cut-outs come
    // from eleven different shoots, and a warm wash in exactly their shape is
    // what makes them read as one lit group rather than a collage.
    '--src': `url(${f.src})`,
  };
}

/** The bench in standing order — back rank outward first, founder last. */
export default PLACEMENT;
