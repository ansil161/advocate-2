// ============================================================
//  SLA — CINEMATIC ARRIVAL · configuration
// ------------------------------------------------------------
//  One continuous world, measured in metres. The camera walks a
//  single unbroken path: pavement → steps → threshold → the
//  chambers → the library → the reading table → the open book.
//  Every module reads its dimensions from here so the world
//  stays consistent and can be re-tuned from one place.
// ============================================================

// ---- the world, in metres -----------------------------------
export const W = {
  eye: 1.66, // standing eye height on the street
  floorY: 1.3, // interior floor — the top of the entrance steps
  ceilingY: 6.95,
  hallHalf: 6.4, // interior side walls at ±6.4

  facadeZ: 0, // outer face of the building
  buildingW: 36,
  buildingH: 17.4,

  doorW: 4.6,
  doorH: 3.95,

  steps: 7,
  stepRise: 1.3 / 7,
  stepDepth: 0.66,
  stepsFrontZ: 7.1, // front edge of the bottom step

  receptionZ: -13.6,
  officeZ: [-16, -42],
  libraryZ: [-46, -76],
  tableZ: -88,
  tableTopY: 2.06, // floorY + 0.76
  endZ: -97,
};

// ---- scroll cue map (progress 0 → 1 across the pinned hero) ---
export const CUE = {
  overlay: [0.015, 0.115], // opening typography steps aside
  signage: [0.14, 0.30], // SLA lettering resolves on the entablature
  // The camera stops moving at 0.545 and the leaves do not start until
  // 0.565: twenty thousandths of the scroll where nothing at all
  // happens. That gap is the arrival — without it the door is already
  // opening before the visitor has registered that they got here.
  arrival: [0.50, 0.565],
  door: [0.565, 0.638], // the leaves swing; the camera crosses at ~0.635
  interior: [0.60, 0.70], // daylight hands over to interior light
  library: [0.83, 0.90],
  book: [0.895, 0.992], // the spread opens
  close: [0.955, 1.0], // final push; background falls away
};

// ---- camera path --------------------------------------------
// Keyframes are sampled on a Catmull-Rom spline; the gaps in `t`
// carry the pacing (a long dwell between 0.545 and 0.578 is the
// pause on the threshold).
export const CAMERA_PATH = [
  { t: 0.0, pos: [2.3, 1.66, 42], look: [0.7, 6.6, 0], fov: 44 },
  { t: 0.08, pos: [2.0, 1.66, 34], look: [0.55, 6.0, 0], fov: 44 },
  { t: 0.17, pos: [1.45, 1.66, 25.5], look: [0.35, 5.2, 0], fov: 43 },
  { t: 0.27, pos: [0.95, 1.68, 17.5], look: [0.15, 4.4, 0], fov: 42 },
  { t: 0.36, pos: [0.4, 1.7, 12.6], look: [0.05, 3.8, 0], fov: 41 },
  { t: 0.44, pos: [0.06, 1.78, 9.2], look: [0.0, 3.2, 0], fov: 41 },
  // The arrival: far enough back that the whole doorway and its
  // surround sit in frame. Any closer and the pause plays out on a
  // black slab with no architecture around it.
  { t: 0.5, pos: [0.0, 2.05, 6.6], look: [0.0, 3.0, -1], fov: 42 },
  { t: 0.545, pos: [0.0, 2.55, 5.3], look: [0.0, 2.95, -3], fov: 42 },
  { t: 0.578, pos: [0.0, 2.7, 4.75], look: [0.0, 2.9, -4.5], fov: 42 },
  { t: 0.632, pos: [0.0, 2.92, -1.1], look: [0.0, 2.72, -11.5], fov: 40 },
  { t: 0.69, pos: [-0.65, 2.92, -9.4], look: [1.1, 2.62, -19], fov: 40 },
  { t: 0.75, pos: [0.55, 2.92, -21.5], look: [-1.3, 2.55, -32], fov: 41 },
  { t: 0.8, pos: [0.15, 2.9, -33], look: [0.25, 2.5, -45], fov: 41 },
  { t: 0.86, pos: [0.0, 2.86, -48], look: [0.0, 2.45, -62], fov: 40 },
  { t: 0.91, pos: [0.0, 2.8, -63], look: [0.0, 2.35, -78], fov: 39 },
  { t: 0.955, pos: [0.0, 3.3, -80.8], look: [0.0, 2.35, -87.4], fov: 40 },
  { t: 0.985, pos: [0.0, 3.1, -86.4], look: [0.0, 2.1, -88.15], fov: 36 },
  { t: 1.0, pos: [0.0, 2.92, -87.05], look: [0.0, 2.06, -88.15], fov: 33 },
];

// Focus distance / blur strength along the journey. Depth of field is
// used to point at things, never to smear the whole frame.
export const FOCUS_PATH = [
  { t: 0.0, focus: 40, blur: 0.55 },
  { t: 0.3, focus: 18, blur: 0.5 },
  { t: 0.5, focus: 7, blur: 0.42 },
  { t: 0.63, focus: 12, blur: 0.34 },
  { t: 0.75, focus: 13, blur: 0.5 },
  // The crossing: the frame goes shallow for the moment he passes.
  { t: 0.81, focus: 14, blur: 0.9 },
  { t: 0.88, focus: 16, blur: 0.55 },
  { t: 0.955, focus: 8, blur: 0.72 },
  { t: 1.0, focus: 1.5, blur: 1.0 },
];

// ---- the people ---------------------------------------------
// `h` is the height in metres of the visible slab of the cutout and
// `base` how far its bottom edge sits above the floor it stands on —
// the seated advocates are cut at the waist, so the desk in front of
// them hides the cut. `yaw` is the resting rotation; `face` is how
// much of a turn toward the camera the billboard is allowed (0 = the
// figure is fixed in the world, 1 = always square to the lens).
export const ADVOCATES = [
  // — outside: the steps of the building —
  {
    // The founder, beside the steps: closest to the path, in the best
    // of the light, and on screen longest. Hierarchy without a caption.
    id: 'sridhar', zone: 'street', h: 1.78, base: 0, pos: [3.5, 0, 10.9],
    yaw: -0.42, face: 0.5, motion: 'talk', priority: 1,
  },
  {
    // On the landing, behind the parapet — which is what hides the
    // point where his photograph is cut.
    id: 'aravind', zone: 'street', h: 1.06, base: 0.66, pos: [-4.3, 1.3, 1.85],
    yaw: 0.5, face: 0.4, motion: 'talk', priority: 2,
  },
  {
    // Walking in toward the entrance, held out to the side of the path
    // so he stays in frame as the camera overtakes him.
    id: 'karupak', zone: 'street', h: 1.32, base: 0.44, pos: [-4.6, 0, 20],
    yaw: 0.05, face: 0.3, motion: 'walk', walk: { to: [-3.2, 0, 11.4], span: [0.02, 0.46] },
  },
  {
    id: 'bharath', zone: 'street', h: 1.36, base: 0.42, pos: [5.0, 0, 17.5],
    yaw: -0.55, face: 0.35, motion: 'talk',
  },
  // — inside: reception, chambers, library. The seated advocates are
  //   cut at the waist, so each one sits behind the desk that hides
  //   the cut; `base` is the height of that cut above the floor. —
  {
    id: 'vinesh', zone: 'interior', h: 0.9, base: 0.5, pos: [4.75, 1.3, -12.9],
    yaw: 0.22, face: 0.4, motion: 'desk',
  },
  {
    id: 'lakshman', zone: 'interior', h: 0.92, base: 0.48, pos: [-4.6, 1.3, -20.5],
    yaw: 0.62, face: 0.45, motion: 'read', priority: 1,
  },
  {
    id: 'pawan', zone: 'interior', h: 0.97, base: 0.44, pos: [2.1, 1.3, -27.6],
    yaw: -0.9, face: 0.3, motion: 'read',
  },
  {
    id: 'karthik', zone: 'interior', h: 0.94, base: 0.46, pos: [4.7, 1.3, -24.7],
    yaw: -0.66, face: 0.45, motion: 'desk',
  },
  {
    id: 'akshay', zone: 'interior', h: 0.97, base: 0.44, pos: [-4.85, 1.3, -30],
    yaw: 0.7, face: 0.4, motion: 'desk',
  },
  {
    id: 'ashok', zone: 'interior', h: 0.87, base: 0.52, pos: [4.65, 1.3, -34],
    yaw: -0.7, face: 0.4, motion: 'desk',
  },
  {
    id: 'manjula', zone: 'library', h: 1.08, base: 0.26, pos: [-2.75, 1.3, -58],
    yaw: 0.85, face: 0.35, motion: 'read',
  },
];

// The advocate who walks across the lens inside the chambers. He
// passes close enough to wipe the frame, which is the transition out
// of the office and into the library — a physical object doing the
// work a cut would otherwise have to do.
export const CROSSING = {
  id: 'sridhar', h: 1.78, base: 0, ahead: 1.55,
  from: [-4.4, 1.3, -34.9], to: [4.6, 1.3, -34.1], span: [0.784, 0.834],
};

// Anonymous clients and passers-by: drawn silhouettes, never invented
// faces. Distance, fog and grade do the rest.
// Ordered by how much each one earns its place: the quality tiers cut
// from the end of the list, and the last two are the only interior
// figures, so a phone still gets the pair standing at the entrance and
// the one figure deep in the stacks.
export const FIGURES = [
  { v: 0, pos: [-8.2, 0, 13.5], h: 1.72, walk: [8.4, 0, 12.2], span: [0.0, 0.58] },
  { v: 3, pos: [-6.2, 0, 6.9], h: 1.7, yaw: 0.62 },
  { v: 1, pos: [-5.35, 0, 7.4], h: 1.66, yaw: 3.5 },
  { v: 2, pos: [6.1, 0, 18.4], h: 1.66, yaw: 2.5 },
  { v: 1, pos: [7.0, 0, 24], h: 1.68, walk: [-6.2, 0, 27], span: [0.04, 0.62] },
  { v: 0, pos: [-11.5, 0, 30], h: 1.71, walk: [-10.2, 0, 9.5], span: [0.0, 0.52] },
  { v: 3, pos: [9.6, 0, 9.2], h: 1.69, yaw: -0.5 },
  { v: 2, pos: [-9.1, 0, 21.5], h: 1.67, yaw: 1.2 },
  { v: 0, pos: [11.2, 0, 15.5], h: 1.7, walk: [11.2, 0, 30], span: [0.02, 0.6] },
  { v: 1, pos: [-2.2, 1.3, 3.1], h: 1.68, yaw: 2.9 },
  { v: 2, pos: [-3.0, 1.3, -44], h: 1.7, yaw: 0.3, interior: true },
  { v: 3, pos: [2.6, 1.3, -68], h: 1.68, yaw: -0.5, interior: true },
];

// ---- quality tiers ------------------------------------------
export function readQuality() {
  if (typeof window === 'undefined') return tier('desktop');
  // Dev-only override: ?tier=mobile renders the phone build on a
  // desktop, which is the only way to check the degraded tiers here —
  // resizing the window does not change what the tier picks.
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(window.location.search).get('tier');
    if (forced && ['desktop', 'tablet', 'mobile'].includes(forced)) return tier(forced);
  }
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (narrow || (coarse && cores <= 6)) return tier('mobile');
  if (cores <= 4 || mem <= 4) return tier('tablet');
  return tier('desktop');
}

function tier(name) {
  const presets = {
    desktop: {
      name, pixelRatio: 1.8, shadows: true, shadowSize: 2048, dof: true,
      reflections: true, silhouettes: 10, shelfUnits: 12, streetProps: true,
      scrollLength: 780, antialias: true,
    },
    tablet: {
      name, pixelRatio: 1.4, shadows: true, shadowSize: 1024, dof: true,
      reflections: false, silhouettes: 7, shelfUnits: 8, streetProps: true,
      scrollLength: 680, antialias: true,
    },
    mobile: {
      name, pixelRatio: 1.35, shadows: false, shadowSize: 512, dof: false,
      reflections: false, silhouettes: 4, shelfUnits: 6, streetProps: false,
      scrollLength: 520, antialias: false,
    },
  };
  return presets[name];
}
