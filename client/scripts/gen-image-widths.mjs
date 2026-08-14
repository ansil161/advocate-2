// Generates the narrow variants used by the `srcset`s on the full-bleed hero
// backgrounds. Run with `npm run images` after adding or replacing a source.
//
// This only ever writes *downscales*. The original file stays the widest entry
// in every srcset, so on a wide viewport the browser still picks exactly the
// file it picked before — desktop rendering is byte-identical. The variants are
// only ever selected on narrower viewports, where they carry the same crop at
// fewer pixels.
//
// Sources wider than the target are skipped rather than upscaled, so adding a
// width here that a given image cannot satisfy is harmless.
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'img');

// Only the images that back a 100vw-or-wider decorative layer. Images used at
// grid or card scale are left alone: their intrinsic size is already close to
// what they are painted at, so a srcset would add files without saving bytes.
const TARGETS = [
  { file: 'hero-courthouse.webp', widths: [760, 1400] },
  { file: 'colonnade-diagonal.webp', widths: [760] },
];

// Matches the visual weight of the existing assets closely enough to be
// indistinguishable at the sizes these are served at.
const QUALITY = 82;

for (const { file, widths } of TARGETS) {
  const src = path.join(DIR, file);
  const meta = await sharp(src).metadata();

  for (const w of widths) {
    if (meta.width <= w) {
      console.log(`skip  ${file} @${w}w — source is only ${meta.width}px wide`);
      continue;
    }
    const out = path.join(DIR, file.replace(/\.webp$/, `-${w}.webp`));
    const info = await sharp(src).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
    console.log(
      `write ${path.basename(out)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`
    );
  }
}
