// ============================================================
//  THE ROAD — path geometry for the Legacy timeline
// ------------------------------------------------------------
//  The Legacy timeline is one continuous line, not a stack of borders, so
//  its geometry has to be authored as a single cubic path. Everything here
//  is parametric: hand it N milestones and it returns the knots (one per
//  milestone) and the `d` that runs through every one of them — which is
//  what lets a milestone marker sit exactly *on* the road rather than
//  approximately near it, at any viewport.
//
//  Two shapes come out of the same builder:
//
//    the wide stage   knots alternate left and right, `sway` is 0, and the
//                     tangent at every knot is vertical — a road winding
//                     down the left third of a cinematic frame.
//    the column       every knot sits on the strip's centre line and the
//                     bow between them alternates side to side, so the road
//                     winds but always crosses the centre where a milestone
//                     dot is waiting.
//
//  Coordinates are viewBox units. Both SVGs are drawn with
//  preserveAspectRatio="none" — on the wide stage 1 x-unit is 1% of the
//  stage width and 1 y-unit is 1% of the stage height — and every stroke
//  carries vector-effect="non-scaling-stroke", so the road keeps its weight
//  in px whatever the viewport does to the box it is drawn in.
// ============================================================

const r = (v) => Math.round(v * 100) / 100;

/** Height of the wide road's viewBox, in units. 1 unit = 1% of the stage height. */
export const ROAD_UNITS = 320;

/** Where the active milestone parks on the stage, 0–1 from the top. */
export const ROAD_EYE = 0.46;

/**
 * Knots for the wide stage — one per milestone, alternating side to side
 * down the left third of the frame, evenly spaced so the camera travels the
 * same distance between every chapter.
 */
// `left`/`right` are the two sides the road swings between, as a percentage of
// the stage width. The right-hand one has to stay clear of the chapter column
// (32% at full width, 29% below 1180px) once the stroke is added to it.
export function roadKnots(n, { units = ROAD_UNITS, head = 30, tail = 26, left = 5.5, right = 26.5 } = {}) {
  const step = n > 1 ? (units - head - tail) / (n - 1) : 0;
  return Array.from({ length: n }, (_, i) => ({ x: i % 2 ? right : left, y: head + i * step }));
}

/**
 * One cubic path through every knot.
 *
 * Control points are placed so the tangent leaving a knot matches the
 * tangent arriving at it (C1) — without that the road kinks visibly at
 * exactly the points the eye is being asked to stop on.
 *
 * @param {{x:number,y:number}[]} knots
 * @param {object} opts
 * @param {number} opts.bow   how far the control points run along the segment (0–0.5)
 * @param {number} opts.sway  lateral bow, alternating per segment. 0 for knots that
 *                            already alternate; non-zero for knots on one line.
 * @param {number} opts.lead  how far the road runs in above the first knot
 * @param {number} opts.tail  how far it runs on past the last
 */
export function pathFromKnots(knots, { bow = 0.42, sway = 0, lead = 40, tail = 26 } = {}) {
  if (!knots.length) return '';
  const dir = (k) => (k % 2 ? -sway : sway);

  const a = knots[0];
  const parts = [
    `M ${r(a.x)} ${r(a.y - lead)}`,
    `C ${r(a.x)} ${r(a.y - lead * 0.5)} ${r(a.x - dir(0))} ${r(a.y - lead * 0.28)} ${r(a.x)} ${r(a.y)}`,
  ];

  for (let i = 0; i < knots.length - 1; i++) {
    const p = knots[i];
    const q = knots[i + 1];
    const dy = (q.y - p.y) * bow;
    const o = dir(i);
    parts.push(`C ${r(p.x + o)} ${r(p.y + dy)} ${r(q.x + o)} ${r(q.y - dy)} ${r(q.x)} ${r(q.y)}`);
  }

  const z = knots[knots.length - 1];
  const o = dir(knots.length - 1);
  parts.push(`C ${r(z.x + o)} ${r(z.y + tail * 0.4)} ${r(z.x)} ${r(z.y + tail * 0.72)} ${r(z.x)} ${r(z.y + tail)}`);

  return parts.join(' ');
}

/**
 * The same road, drawn anywhere between two orientations.
 *
 * At `t = 0` this is identical to `pathFromKnots` with no sway — a road that
 * runs down the frame, with a vertical tangent at every knot. At `t = 1` the
 * tangents are horizontal instead, so the same knots read as a road running
 * across the frame. Feeding it interpolated knots and a matching `t` turns the
 * closing pull-back into one continuous unfolding rather than a cut between
 * two drawings.
 */
export function blendedPath(knots, t, { bow = 0.42, lead = 40, tail = 26 } = {}) {
  if (!knots.length) return '';
  const a = knots[0];
  const z = knots[knots.length - 1];
  const lx = -lead * t;
  const ly = -lead * (1 - t);

  const parts = [
    `M ${r(a.x + lx)} ${r(a.y + ly)}`,
    `C ${r(a.x + lx * 0.5)} ${r(a.y + ly * 0.5)} ${r(a.x + lx * 0.28)} ${r(a.y + ly * 0.28)} ${r(a.x)} ${r(a.y)}`,
  ];

  for (let i = 0; i < knots.length - 1; i++) {
    const p = knots[i];
    const q = knots[i + 1];
    const ox = (q.x - p.x) * bow * t;
    const oy = (q.y - p.y) * bow * (1 - t);
    parts.push(`C ${r(p.x + ox)} ${r(p.y + oy)} ${r(q.x - ox)} ${r(q.y - oy)} ${r(q.x)} ${r(q.y)}`);
  }

  const tx = tail * t;
  const ty = tail * (1 - t);
  parts.push(
    `C ${r(z.x + tx * 0.4)} ${r(z.y + ty * 0.4)} ${r(z.x + tx * 0.72)} ${r(z.y + ty * 0.72)} ${r(z.x + tx)} ${r(z.y + ty)}`
  );

  return parts.join(' ');
}

/**
 * Where each knot falls along the path, as a 0–1 fraction of its total
 * length — the number that ties "the road has reached 1996" to the scroll
 * position at which the 1996 chapter arrives.
 *
 * Measured off the rendered path rather than computed, so it stays true if
 * the curve is ever re-authored.
 */
export function lengthFractions(pathEl, knots, samples = 480) {
  const len = pathEl.getTotalLength();
  const pts = new Array(samples + 1);
  for (let i = 0; i <= samples; i++) pts[i] = pathEl.getPointAtLength((len * i) / samples);

  return knots.map((k) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= samples; i++) {
      const dx = pts[i].x - k.x;
      const dy = pts[i].y - k.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best / samples;
  });
}
