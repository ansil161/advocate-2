// Placement data for the Team hero lineup.
//
// The bench was never photographed together, so the hero stands eleven
// separate cut-outs in one row. The sources are wildly inconsistent — a full
// standing shot next to a tight head-and-shoulders — so each figure carries
// measurements that let the CSS normalise it:
//
//   w, h    the image's own size, in head-widths
//   crown   distance from the top of the image down to the top of the skull,
//           in head-widths
//   cx      distance from the left of the image to the centre of the head,
//           in head-widths
//   l, r    how far the shoulders reach either side of the head, in
//           head-widths
//
// Sizing every figure off `--head` therefore renders every advocate's head at
// the same physical width, and `crown`/`cx` put that head on the shared crown
// line. `l`/`r` set how much floor each one claims: spacing the heads evenly
// instead leaves holes, because several sources frame their subject hard left
// or hard right and their body ends up entirely to one side of their face.
// Packing by shoulder is what closes the row up.
//
// All of it was measured off the alpha silhouettes rather than eyeballed;
// re-measure if a portrait is replaced.
//
// Filenames follow the informal first-name spellings the firm supplied, not
// the slugs — same mapping as teamPhotos.js.
import sridhar from '../../../assets/team/lineup/sridhar.webp';
import lakshman from '../../../assets/team/lineup/lakshman.webp';
import aravind from '../../../assets/team/lineup/aravind.webp';
import manjula from '../../../assets/team/lineup/manjula.webp';
import ashok from '../../../assets/team/lineup/ashok.webp';
import vinesh from '../../../assets/team/lineup/vinesh.webp';
import karupak from '../../../assets/team/lineup/karupak.webp';
import akshay from '../../../assets/team/lineup/akshay.webp';
import pawan from '../../../assets/team/lineup/pawan.webp';
import karthik from '../../../assets/team/lineup/karthik.webp';
import bharath from '../../../assets/team/lineup/bharath.webp';

const FIGURES = {
  'sridhar-lendalay': { src: sridhar, w: 3.708, h: 6.832, crown: 0.025, cx: 1.652, l: 1.217, r: 1.509 },
  'palanati-lakshman': { src: lakshman, w: 3.053, h: 3.722, crown: 0.008, cx: 1.747, l: 1.747, r: 1.249 },
  'tv-arvind': { src: aravind, w: 2.531, h: 4.981, crown: 0.025, cx: 1.395, l: 0.864, r: 1.136 },
  'manjula-lendalay': { src: manjula, w: 3.311, h: 3.407, crown: 0.028, cx: 1.194, l: 1.075, r: 1.015 },
  'ashok-kumar-shetty': { src: ashok, w: 3.247, h: 3.414, crown: 0.027, cx: 2.602, l: 0.901, r: 0.78 },
  'vinesh-lendalay': { src: vinesh, w: 2.147, h: 3.312, crown: 0.037, cx: 0.807, l: 0.78, r: 1.257 },
  'beemanaboina-krupakar': { src: karupak, w: 3.464, h: 4.541, crown: 0.019, cx: 1.888, l: 1.343, r: 1.296 },
  'akshay-kumar-nakka': { src: akshay, w: 3.539, h: 4.404, crown: 0.017, cx: 2.118, l: 0.78, r: 1.359 },
  'pavan-gajjela': { src: pawan, w: 4.139, h: 3.619, crown: 0.01, cx: 2.069, l: 1.341, r: 1.585 },
  'karthik-yadav': { src: karthik, w: 3.613, h: 3.706, crown: 0.019, cx: 1.925, l: 1.775, r: 1.318 },
  'bharath-raj-lendalay': { src: bharath, w: 3.099, h: 5.284, crown: 0.014, cx: 1.688, l: 1.337, r: 1.021 },
};

export function figureFor(slug) {
  return FIGURES[slug] || null;
}

/** Custom properties the lineup CSS reads to place one figure. */
export function figureVars(slug) {
  const f = FIGURES[slug];
  if (!f) return undefined;
  return {
    '--fig-w': f.w,
    '--fig-h': f.h,
    '--fig-crown': f.crown,
    '--fig-cx': f.cx,
    '--fig-l': f.l,
    '--fig-r': f.r,
  };
}

export default FIGURES;
