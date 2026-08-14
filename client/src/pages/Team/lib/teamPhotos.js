// The source of truth for a *framed* advocate portrait — the rectangular
// photograph AdvocateCard crops into its 3:4 box on the Team page. Bundled
// rather than served from public/, so each file is hashed and cache-busted.
//
// Filenames don't all match slugs — the firm supplied them under informal
// first-name spellings — so the mapping is explicit.
//
// This is deliberately not the only set of advocate images, and the others are
// not duplicates of it. Each composition needs a different asset:
//
//   assets/team/web/      opaque photographs, mixed portrait and landscape,
//                         cropped by object-fit    → AdvocateCard  (this file)
//   public/team/          background-free cut-outs, portrait, figure bleeding
//                         past the plate edges     → CounselCard   (data/team.js `photo`;
//                                                    spec in public/team/README.md)
//   assets/team/cutout/   the same cut-outs downscaled for GPU upload
//                         → the Three.js hero's billboards (HeroCharacters.js)
//
// Pointing any of the three at another's files would put an opaque rectangle
// where a cut-out figure is expected, or a 1400px photograph into a texture atlas.
import sridhar from '../../../assets/team/web/sridhar.webp';
import lakshman from '../../../assets/team/web/lakshman.webp';
import aravind from '../../../assets/team/web/aravind.webp';
import manjula from '../../../assets/team/web/manjula.webp';
import ashok from '../../../assets/team/web/ashok.webp';
import vinesh from '../../../assets/team/web/vinesh.webp';
import karupak from '../../../assets/team/web/karupak.webp';
import akshay from '../../../assets/team/web/akshay.webp';
import pawan from '../../../assets/team/web/pawan.webp';
import karthik from '../../../assets/team/web/karthik.webp';
import bharath from '../../../assets/team/web/bharath.webp';

const PHOTOS = {
  'sridhar-lendalay': sridhar,
  'palanati-lakshman': lakshman,
  'tv-arvind': aravind,
  'manjula-lendalay': manjula,
  'ashok-kumar-shetty': ashok,
  'vinesh-lendalay': vinesh,
  'beemanaboina-krupakar': karupak,
  'akshay-kumar-nakka': akshay,
  'pavan-gajjela': pawan,
  'karthik-yadav': karthik,
  'bharath-raj-lendalay': bharath,
};

export function photoFor(slug) {
  return PHOTOS[slug] || null;
}

export default PHOTOS;
