// Real advocate portraits. Filenames don't all match slugs — the firm supplied
// them under informal first-name spellings, so the mapping is explicit.
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
