# Advocate portraits

| File                       | Advocate          | Source                                        |
| -------------------------- | ----------------- | --------------------------------------------- |
| `sridhar-lendalay.webp`    | Sridhar Lendalay  | matted out of the reference card mock-up      |
| `palanati-lakshman.webp`   | Palanati Lakshman | `src/assets/team/cutout/lakshman.webp` (rembg) |

More cut-outs already exist for the rest of the bench in
`src/assets/team/cutout/` — they were matted with rembg's `u2net_human_seg`
model for the Home hero. Copy one here under its slug to give that advocate a
`CounselCard` figure.

To add another, drop the file here named after the advocate's `slug` in
`src/data/team.js`, then add a matching `photo: '/team/<slug>.webp'` line to
that entry. Advocates without a `photo` render the monogram composition
instead — the card stays intact, it just loses the figure.

## Spec

The card stands the figure in front of the black plate — the head breaks the top
edge, the shoulder sits flush with the bottom — so a portrait must be a
**cut-out with a fully transparent background**, not a rectangular headshot.

- **Format** — WebP or PNG with alpha.
- **Size** — around 1200 × 1600 px, portrait. The card scales by height, so
  larger is fine; keep each file under ~150 KB.
- **Framing** — head near the top of the canvas, cropped around the waist, with
  no empty margin: the subject should touch the top and bottom edges, because
  the card anchors the image by its bottom.
- **Lighting** — a dark suit against the near-black plate reads best. A little
  rim light on the shoulders helps the silhouette separate.

Below the plate's top edge the subject sits on black, so an imperfect matte
around a dark suit is invisible there. The part that must be clean is whatever
rises above that edge — the head and hair — which lands on the cream page.
