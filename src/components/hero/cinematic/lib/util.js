// Small maths + housekeeping helpers shared by the hero modules.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

// Progress inside a [start, end] window, clamped to 0..1.
export const span = (t, [a, b]) => clamp(invLerp(a, b, t));

export const smoothstep = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const easeInOut = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};

export const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;

// Deterministic RNG — the world must look identical on every load.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom through p1→p2, with p0/p3 as tangent context.
export function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

// Sample a keyframe track [{t, ...}] on a Catmull-Rom spline.
// `keys` are read through `get(key) -> number[]`; returns number[].
//
// The local parameter is deliberately linear. Easing inside each
// segment drives velocity to zero at every keyframe, so the camera
// stops dead at each one and the whole travel judders; a Catmull-Rom
// is already C1-continuous, and the pacing belongs in how far apart
// the keyframes are placed, not in a curve applied between them.
export function sampleTrack(keys, t, get, ease = (x) => x) {
  const n = keys.length;
  let i = 0;
  while (i < n - 2 && t > keys[i + 1].t) i += 1;
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const local = ease(invLerp(k1.t, k2.t, t));
  const a = get(keys[Math.max(0, i - 1)]);
  const b = get(k1);
  const c = get(k2);
  const d = get(keys[Math.min(n - 1, i + 2)]);
  const out = new Array(b.length);
  for (let j = 0; j < b.length; j += 1) out[j] = catmull(a[j], b[j], c[j], d[j], local);
  return out;
}

// Scalar version of the above.
export function sampleScalar(keys, t, key) {
  return sampleTrack(keys, t, (k) => [k[key]])[0];
}

// Free every GPU resource under a subtree.
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => {
        if (v && v.isTexture) v.dispose();
      });
      m.dispose();
    });
  });
}
