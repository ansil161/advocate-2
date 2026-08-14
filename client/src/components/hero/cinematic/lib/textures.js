// ============================================================
//  Procedural texture kit
// ------------------------------------------------------------
//  Every surface in the hero is drawn on a canvas at load time
//  rather than downloaded: it keeps the payload to the eleven
//  real photographs, and it keeps the whole world inside one
//  warm greyscale range, which is what makes the grade read as
//  black-and-white architectural photography instead of a
//  collection of stock materials.
// ============================================================
import * as THREE from 'three';
import { rng, clamp } from './util.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function make(key, w, h, draw, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

// ---- value noise -------------------------------------------
function grid(n, rand) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i += 1) g[i] = rand();
  return g;
}

function sampleGrid(g, n, x, y) {
  const fx = x * n;
  const fy = y * n;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const i = (xx, yy) => g[(((yy % n) + n) % n) * n + (((xx % n) + n) % n)];
  const a = i(x0, y0) + (i(x0 + 1, y0) - i(x0, y0)) * sx;
  const b = i(x0, y0 + 1) + (i(x0 + 1, y0 + 1) - i(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

function fbm(seed, octaves = 4, base = 4) {
  const rand = rng(seed);
  const grids = [];
  for (let o = 0; o < octaves; o += 1) grids.push(grid(base << o, rand));
  return (x, y) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      sum += sampleGrid(grids[o], base << o, x, y) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

// Paint an fbm field through a tone ramp.
function paintNoise(ctx, w, h, seed, ramp, opts = {}) {
  const n = fbm(seed, opts.octaves ?? 4, opts.base ?? 4);
  const img = ctx.createImageData(w, h);
  const sx = opts.scaleX ?? 1;
  const sy = opts.scaleY ?? 1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = n(((x / w) * sx) % 1, ((y / h) * sy) % 1);
      const [r, g, b] = ramp(v, x / w, y / h);
      const i = (y * w + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const warm = (v, warmth = 1) => [
  clamp(v, 0, 255),
  clamp(v * (1 - 0.012 * warmth), 0, 255),
  clamp(v * (1 - 0.035 * warmth), 0, 255),
];

// ---- architectural surfaces ---------------------------------

// Ashlar limestone — the building itself. Wide courses, fine grain.
export const stone = () =>
  make('stone', 512, 512, (ctx, w, h) => {
    paintNoise(ctx, w, h, 21, (v) => warm(150 + v * 46));
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1.6;
    const course = h / 6;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, i * course);
      ctx.lineTo(w, i * course);
      ctx.stroke();
      // staggered vertical joints
      const off = i % 2 ? 0 : w / 6;
      for (let j = 0; j < 3; j += 1) {
        const x = off + (j * w) / 3;
        ctx.beginPath();
        ctx.moveTo(x, i * course);
        ctx.lineTo(x, (i + 1) * course);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, i * course + 1.6);
      ctx.lineTo(w, i * course + 1.6);
      ctx.stroke();
    }
  });

// Pavement slabs.
export const pavement = () =>
  make('pavement', 512, 512, (ctx, w, h) => {
    paintNoise(ctx, w, h, 7, (v) => warm(88 + v * 40), { octaves: 5 });
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
  }, { repeat: [1, 1] });

// Polished stone floor for the interior.
export const marble = () =>
  make('marble', 512, 512, (ctx, w, h) => {
    paintNoise(ctx, w, h, 44, (v) => warm(96 + v * 30), { octaves: 5, base: 3 });
    const rand = rng(9);
    ctx.lineWidth = 1;
    for (let i = 0; i < 26; i += 1) {
      ctx.strokeStyle = `rgba(255,255,255,${0.03 + rand() * 0.05})`;
      ctx.beginPath();
      let x = rand() * w;
      let y = rand() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s += 1) {
        x += (rand() - 0.35) * 90;
        y += (rand() - 0.5) * 34;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  });

// Dark hardwood — doors, desks, shelving, the reading table.
export const wood = (tone = 'dark') =>
  make(`wood-${tone}`, 512, 512, (ctx, w, h) => {
    const base = tone === 'dark' ? 44 : 82;
    const rangeV = tone === 'dark' ? 26 : 34;
    paintNoise(ctx, w, h, tone === 'dark' ? 13 : 31, (v) => warm(base + v * rangeV, 2.4), {
      octaves: 4, scaleX: 0.35, scaleY: 3,
    });
    const rand = rng(tone === 'dark' ? 3 : 5);
    for (let i = 0; i < 90; i += 1) {
      ctx.strokeStyle = `rgba(0,0,0,${0.05 + rand() * 0.12})`;
      ctx.lineWidth = 0.6 + rand() * 1.6;
      const y = rand() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 12, w * 0.7, y + (rand() - 0.5) * 12, w, y + (rand() - 0.5) * 6);
      ctx.stroke();
    }
  });

// Paper — documents, the pages of the book.
export const paper = () =>
  make('paper', 256, 256, (ctx, w, h) => {
    paintNoise(ctx, w, h, 61, (v) => warm(214 + v * 26, 1.6), { octaves: 5, base: 8 });
  });

// A run of legal volumes: varied spine widths, heights and tones.
export const bookRow = () =>
  make('bookrow', 512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0b0a09';
    ctx.fillRect(0, 0, w, h);
    const rand = rng(101);
    let x = 0;
    while (x < w) {
      const bw = 9 + rand() * 17;
      const top = 6 + rand() * 22;
      const v = 62 + rand() * 82;
      const [r, g, b] = warm(v, 2.2);
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(x, top, bw - 1.5, h - top);
      // spine highlight + two gilt bands
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x, top, 1.4, h - top);
      ctx.fillStyle = `rgba(212,180,132,${0.18 + rand() * 0.3})`;
      ctx.fillRect(x + 2, top + 14 + rand() * 10, bw - 6, 2);
      ctx.fillRect(x + 2, top + 40 + rand() * 26, bw - 6, 1.4);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x + bw - 2.4, top, 2.4, h - top);
      x += bw;
    }
    // shelf shadow gradient
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)');
    gr.addColorStop(0.4, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  });

// A window: daylight beyond, with glazing bars. Deliberately not
// white — an unlit basic material cannot be exposed down by the
// grade, so a paper-white pane would blow out every interior shot.
export const windowPane = () =>
  make('window', 256, 512, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#e4e1d9');
    gr.addColorStop(0.55, '#cfccc3');
    gr.addColorStop(1, '#a7a49b');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20,19,16,0.85)';
    for (let i = 1; i < 3; i += 1) ctx.fillRect((i * w) / 3 - 3, 0, 6, h);
    for (let i = 1; i < 5; i += 1) ctx.fillRect(0, (i * h) / 5 - 3, w, 6);
    // A soft bloom around the bars, so glass reads as glass.
    ctx.filter = 'blur(6px)';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
  }, { clamp: true });

// ---- masks and helpers --------------------------------------

// Soft radial falloff, used for contact shadows and light pools.
export const blob = () =>
  make('blob', 128, 128, (ctx, w, h) => {
    const gr = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }, { clamp: true, data: true });

// ---- anonymous figures --------------------------------------
// Clients and passers-by are drawn as silhouettes. No invented
// faces: at this distance a real photograph would read the same,
// and a fabricated one would be a lie.
export const silhouette = (variant = 0) =>
  make(`fig-${variant}`, 256, 512, (ctx, w, h) => {
    const rand = rng(variant * 977 + 13);
    ctx.clearRect(0, 0, w, h);
    ctx.filter = 'blur(1.6px)';
    ctx.fillStyle = '#0d0d0c';

    const cx = w / 2;
    const stride = variant === 0 ? 1 : variant === 1 ? 0.45 : 0.12;
    const lean = (variant === 0 ? 1 : 0) * 0.04;

    // legs
    const hipY = 268;
    const footY = 500;
    const leg = (dir) => {
      const dx = dir * stride * 26;
      ctx.beginPath();
      ctx.moveTo(cx - 20, hipY);
      ctx.quadraticCurveTo(cx - 14 + dx * 0.5, hipY + 110, cx - 12 + dx, footY);
      ctx.lineTo(cx + 9 + dx, footY);
      ctx.quadraticCurveTo(cx + 6 + dx * 0.5, hipY + 110, cx + 20, hipY);
      ctx.closePath();
      ctx.fill();
    };
    leg(1);
    leg(-1);

    // torso
    ctx.beginPath();
    ctx.moveTo(cx - 40, 104);
    ctx.quadraticCurveTo(cx - 46, 190, cx - 34, hipY + 6);
    ctx.lineTo(cx + 34, hipY + 6);
    ctx.quadraticCurveTo(cx + 46, 190, cx + 40, 104);
    ctx.quadraticCurveTo(cx, 82, cx - 40, 104);
    ctx.closePath();
    ctx.fill();

    // arms
    const arm = (dir, swing) => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 38, 110);
      ctx.quadraticCurveTo(cx + dir * 50 + swing * 8, 190, cx + dir * 42 + swing * 20, 262);
      ctx.lineTo(cx + dir * 28 + swing * 20, 262);
      ctx.quadraticCurveTo(cx + dir * 34 + swing * 8, 190, cx + dir * 24, 112);
      ctx.closePath();
      ctx.fill();
    };
    arm(1, stride * (variant === 3 ? -0.6 : 1));
    arm(-1, -stride);

    // head + neck
    ctx.beginPath();
    ctx.ellipse(cx + lean * 200, 52, 23, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 9, 72, 18, 26);

    // what they carry — a file, a folder, a case
    if (variant === 0) {
      ctx.fillRect(cx + 40, 250, 34, 44); // briefcase
    } else if (variant === 3) {
      ctx.save();
      ctx.translate(cx - 40, 210);
      ctx.rotate(-0.25);
      ctx.fillRect(0, 0, 44, 58); // folder held to the chest
      ctx.restore();
    }
    ctx.filter = 'none';

    // a touch of tonal variation so they are not flat cut-outs
    ctx.globalCompositeOperation = 'source-atop';
    const gr = ctx.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, `rgba(255,255,255,${0.1 + rand() * 0.06})`);
    gr.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }, { clamp: true });

// ---- lettering ----------------------------------------------
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Inter, system-ui, sans-serif';

function tracked(ctx, text, x, y, tracking) {
  const chars = [...text];
  const total = chars.reduce((s, c) => s + ctx.measureText(c).width + tracking, -tracking);
  let cx = x - total / 2;
  chars.forEach((c) => {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + tracking;
  });
}

// The firm's name on the entablature.
export const signage = () =>
  make('signage', 2048, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#efe9dc';
    ctx.font = `500 128px ${SERIF}`;
    tracked(ctx, 'SLA ADVOCATES', w / 2, 92, 26);
    ctx.fillStyle = 'rgba(239,233,220,0.62)';
    ctx.font = `500 40px ${SANS}`;
    tracked(ctx, 'ADVOCATES & LEGAL CONSULTANTS', w / 2, 186, 16);
  }, { clamp: true });

// The engraved plate beside the door.
export const plaque = () =>
  make('plaque', 512, 512, (ctx, w, h) => {
    paintNoise(ctx, w, h, 71, (v) => warm(52 + v * 26, 2));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(226,214,190,0.9)';
    ctx.font = `500 118px ${SERIF}`;
    ctx.fillText('SLA', w / 2, 176);
    ctx.strokeStyle = 'rgba(226,214,190,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, 250);
    ctx.lineTo(w * 0.74, 250);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226,214,190,0.72)';
    ctx.font = `500 34px ${SANS}`;
    tracked(ctx, 'ADVOCATES', w / 2, 306, 9);
    ctx.fillStyle = 'rgba(226,214,190,0.4)';
    ctx.font = `400 28px ${SANS}`;
    tracked(ctx, 'EST. 2013', w / 2, 370, 7);
  }, { clamp: true });

// ---- the open book ------------------------------------------
function pageGround(ctx, w, h, spineOnRight) {
  paintNoise(ctx, w, h, 97, (v) => warm(216 + v * 24, 1.4), { octaves: 5, base: 8 });
  // shading into the gutter, so the spread reads as a bound volume
  const gr = ctx.createLinearGradient(spineOnRight ? w : 0, 0, spineOnRight ? 0 : w, 0);
  gr.addColorStop(0, 'rgba(28,24,18,0.42)');
  gr.addColorStop(0.16, 'rgba(28,24,18,0.06)');
  gr.addColorStop(1, 'rgba(28,24,18,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, w, h);
  // aged edge
  const edge = ctx.createLinearGradient(spineOnRight ? 0 : w, 0, spineOnRight ? w : 0, 0);
  edge.addColorStop(0, 'rgba(120,100,70,0.22)');
  edge.addColorStop(0.1, 'rgba(120,100,70,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

// Left page — the firm, and the conviction it was founded on.
export const bookLeft = () =>
  make('book-left', 1024, 1024, (ctx, w, h) => {
    pageGround(ctx, w, h, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(40,34,24,0.55)';
    ctx.font = `600 26px ${SANS}`;
    tracked(ctx, 'EST. 2013 — HYDERABAD', w / 2, 210, 11);

    ctx.fillStyle = '#1b1813';
    ctx.font = `500 132px ${SERIF}`;
    tracked(ctx, 'SLA', w / 2, 360, 14);
    ctx.font = `400 62px ${SERIF}`;
    tracked(ctx, 'ADVOCATES', w / 2, 452, 16);

    ctx.strokeStyle = 'rgba(40,34,24,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.34, 528);
    ctx.lineTo(w * 0.66, 528);
    ctx.stroke();

    ctx.fillStyle = 'rgba(30,26,19,0.82)';
    ctx.font = `400 44px ${SERIF}`;
    ctx.fillText('A judgment is only as good', w / 2, 622);
    ctx.fillText('as its execution.', w / 2, 682);

    ctx.fillStyle = 'rgba(40,34,24,0.45)';
    ctx.font = `400 24px ${SANS}`;
    tracked(ctx, 'ADVOCATES & LEGAL CONSULTANTS', w / 2, 812, 8);
  }, { clamp: true });

// Right page — the record. Every figure here is sourced from the
// firm's own material (src/data/firm.js, src/data/practiceAreas.js).
export const bookRight = (rows) =>
  make('book-right', 1024, 1024, (ctx, w, h) => {
    pageGround(ctx, w, h, false);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(40,34,24,0.5)';
    ctx.font = `600 24px ${SANS}`;
    tracked(ctx, 'THE RECORD', w / 2, 208, 12);

    let y = 330;
    rows.forEach((row, i) => {
      ctx.fillStyle = '#1b1813';
      ctx.font = `400 96px ${SERIF}`;
      ctx.fillText(row.value, w / 2, y);
      ctx.fillStyle = 'rgba(40,34,24,0.6)';
      ctx.font = `500 25px ${SANS}`;
      tracked(ctx, row.label.toUpperCase(), w / 2, y + 74, 9);
      if (i < rows.length - 1) {
        ctx.strokeStyle = 'rgba(40,34,24,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(w * 0.3, y + 132);
        ctx.lineTo(w * 0.7, y + 132);
        ctx.stroke();
      }
      y += 200;
    });
  }, { clamp: true });

export function disposeTextures() {
  cache.forEach((t) => t.dispose());
  cache.clear();
}
