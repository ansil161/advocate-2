// ============================================================
//  ORGANIC CENTRE-OUT REVEAL MASK
// ------------------------------------------------------------
//  The About hero dissolves a pale "plaster model" veil off the photograph
//  from the heart of the portico outward. A plain radial-gradient mask reads
//  as a mechanical circle; what we want is the way ink wicks through paper —
//  an irregular front that runs ahead of itself in some places and lags in
//  others, but never looks like a glitch.
//
//  Rather than recomputing that front every scroll frame (a full-viewport
//  per-pixel job, or an SVG displacement filter re-running on every tick),
//  we bake it once: a single fractal-noise field is evaluated at load, then
//  sliced at a ladder of thresholds into static alpha masks. Scrolling only
//  ever swaps which baked mask is bound — a cheap raster the compositor
//  handles — so nothing but `mask-image` changes, and never per frame.
//
//  Masks are generated lazily and cached, so a visitor who never scrolls
//  past the drawing phase pays for none of them.
// ============================================================

// Small on purpose: the mask is stretched to the viewport by `mask-size`,
// and its soft thresholded edge upscales into exactly the diffusion we want.
const MASK_W = 208;
const MASK_H = 117;

// Threshold sweep. tMin sits below the field's floor so stage 0 is fully
// opaque (nothing revealed); tMax sits above its ceiling so the final stage
// clears the corners completely.
const T_MIN = -0.4;
const T_MAX = 2.45;
// >1 makes the bloom open slowly and then run — architecture emerging, not a wipe.
const T_CURVE = 1.45;
// Width of the soft band at the reveal front, in field units. Narrow enough that
// the front reads as an edge rather than a haze, wide enough that upscaling the
// mask to the viewport keeps it a diffusion rather than a cut.
const EDGE = 0.11;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const fade = (t) => t * t * (3 - 2 * t);

function makeGrid(size, rand) {
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  return g;
}

// Bilinear, smoothstep-interpolated, wrapping value noise.
function sampleGrid(g, size, x, y) {
  const fx = x * size;
  const fy = y * size;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const u = fade(fx - x0);
  const v = fade(fy - y0);
  const at = (xx, yy) => g[(((yy % size) + size) % size) * size + (((xx % size) + size) % size)];
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), u),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), u),
    v
  );
}

/**
 * Bakes the reveal field and hands back a lazy mask factory.
 *
 * @param {object} opts
 * @param {number} opts.cx  bloom origin, 0–1 across the stage
 * @param {number} opts.cy  bloom origin, 0–1 down the stage
 * @param {number} opts.rx  horizontal reach of the bloom ellipse
 * @param {number} opts.ry  vertical reach — taller than wide, so the reveal
 *                          runs up and down the central bay before it spreads
 *                          along the colonnade
 * @param {number} opts.stages  rungs on the threshold ladder
 * @param {number} opts.amp     how far the noise drags the front off-circle
 * @param {number} opts.seed
 */
export function createRevealMasks({
  cx = 0.62,
  cy = 0.44,
  rx = 0.46,
  ry = 0.62,
  stages = 44,
  amp = 0.24,
  seed = 20130701,
} = {}) {
  const rand = mulberry32(seed);
  // Four octaves: the coarse ones decide the overall lobed shape, the fine
  // ones give the front its wicked, papery edge.
  const octaves = [
    { grid: makeGrid(3, rand), size: 3, w: 0.5 },
    { grid: makeGrid(6, rand), size: 6, w: 0.26 },
    { grid: makeGrid(13, rand), size: 13, w: 0.15 },
    { grid: makeGrid(27, rand), size: 27, w: 0.09 },
  ];

  // Pre-evaluate the field once; every stage is just a threshold of it.
  const field = new Float32Array(MASK_W * MASK_H);
  for (let y = 0; y < MASK_H; y++) {
    const ny = (y + 0.5) / MASK_H;
    for (let x = 0; x < MASK_W; x++) {
      const nx = (x + 0.5) / MASK_W;
      let n = 0;
      for (const o of octaves) n += o.w * sampleGrid(o.grid, o.size, nx, ny);
      const dx = (nx - cx) / rx;
      const dy = (ny - cy) / ry;
      field[y * MASK_W + x] = Math.sqrt(dx * dx + dy * dy) + amp * (n - 0.5) * 2;
    }
  }

  const cache = new Array(stages).fill(null);
  let canvas = null;

  function bake(i) {
    if (cache[i]) return cache[i];
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = MASK_W;
      canvas.height = MASK_H;
    }
    const ctx = canvas.getContext('2d');
    const id = ctx.createImageData(MASK_W, MASK_H);
    const d = id.data;
    const t = T_MIN + (T_MAX - T_MIN) * Math.pow(i / (stages - 1), T_CURVE);
    for (let k = 0, p = 0; k < field.length; k++, p += 4) {
      // Veil survives where the field is still beyond the front.
      const s = Math.min(1, Math.max(0, (field[k] - t) / EDGE));
      d[p] = 255;
      d[p + 1] = 255;
      d[p + 2] = 255;
      d[p + 3] = Math.round(s * s * (3 - 2 * s) * 255);
    }
    ctx.putImageData(id, 0, 0);
    cache[i] = canvas.toDataURL('image/png');
    return cache[i];
  }

  let idleHandle = null;
  const cancelIdle =
    typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;

  return {
    stages,
    /** Mask for a 0–1 reveal progress. */
    at(progress) {
      const i = Math.min(stages - 1, Math.max(0, Math.round(progress * (stages - 1))));
      return { index: i, url: bake(i) };
    },
    /**
     * Walk the whole ladder ahead of time, a few rungs per idle slice.
     *
     * Baking a rung costs a few milliseconds — nothing on its own, but the
     * reveal crosses every rung exactly once, so baking on demand spends that
     * cost on the one frame that can least afford it and drops it. Measured
     * cold, the bloom ran at roughly half the frame rate of a second pass over
     * the same scroll; paid up front during idle time, the two are identical.
     */
    prebake() {
      let i = 0;
      const schedule =
        typeof requestIdleCallback === 'function'
          ? requestIdleCallback
          : (fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 1);
      const step = (deadline) => {
        while (i < stages && (deadline.timeRemaining() > 6 || i === 0)) bake(i++);
        idleHandle = i < stages ? schedule(step) : null;
      };
      idleHandle = schedule(step);
    },
    dispose() {
      if (idleHandle != null) cancelIdle(idleHandle);
      idleHandle = null;
    },
  };
}
