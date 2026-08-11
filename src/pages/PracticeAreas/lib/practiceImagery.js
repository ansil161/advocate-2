// ============================================================
//  PRACTICE IMAGERY
// ------------------------------------------------------------
//  The cinematic sequence resolves into one photograph — the institutional
//  environment the practice is heard in. Every image here is an existing
//  project asset: real architecture, monochrome, no SLA premises are implied
//  and no photograph is captioned as anything other than what it is.
//
//  The map is keyed by slug so each practice arrives somewhere of its own,
//  and falls back to a deterministic pick so a practice area added to
//  data/practiceAreas.js later still works without touching this file.
// ============================================================
import colonnade from '../../../assets/img/colonnade-diagonal.webp';
import corridor from '../../../assets/img/about-colonnade.webp';
import stone from '../../../assets/img/columns-abstract.webp';
import library from '../../../assets/img/library-moody.webp';

// Two plates are deliberately absent.
//
// hero-courthouse.webp, because the arrival at the top of every practice page
// is already that building — resolving the Chamber into the same photograph
// would end the journey where it started.
//
// sla-building.webp, because that is the firm's own premises, and the Chamber
// is about the forums a matter is heard in. Nothing here is captioned, and
// nothing here is presented as an SLA office or as a named court.
//
// `sm` is only set where a genuinely smaller encode exists in the repo — a
// srcSet that lies about its widths is worse than no srcSet at all.
const PLATES = {
  colonnade: { src: colonnade, w: 1600 },
  corridor: { src: corridor, w: 1500 },
  stone: { src: stone, w: 1200 },
  library: { src: library, w: 1400 },
};

const ORDER = ['colonnade', 'corridor', 'stone', 'library'];

const BY_SLUG = {
  'civil-litigation': 'colonnade',
  'criminal-law': 'stone',
  'constitutional-writ-practice': 'corridor',
  'corporate-commercial-law': 'stone',
  'banking-financial-laws': 'library',
  'insolvency-bankruptcy': 'stone',
  'taxation-laws': 'corridor',
  'labour-employment-law': 'colonnade',
  'intellectual-property-rights': 'library',
  'real-estate-infrastructure': 'stone',
  'family-succession-matters': 'corridor',
  'consumer-product-liability': 'colonnade',
};

// Stable per-slug fallback: same practice always resolves to the same plate,
// so the page never changes character between visits.
function fallbackKey(slug = '') {
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return ORDER[h % ORDER.length];
}

export function chamberImage(slug) {
  const plate = PLATES[BY_SLUG[slug] || fallbackKey(slug)];
  return {
    src: plate.src,
    srcSet: plate.sm ? `${plate.sm} ${plate.smW}w, ${plate.src} ${plate.w}w` : undefined,
  };
}
