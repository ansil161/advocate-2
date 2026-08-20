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

import sridharCutout from '../../../assets/team/cutout/sridhar.webp';
import lakshmanCutout from '../../../assets/team/cutout/lakshman.webp';
import aravindCutout from '../../../assets/team/cutout/aravind.webp';
import manjulaCutout from '../../../assets/team/cutout/manjula.webp';
import ashokCutout from '../../../assets/team/cutout/ashok.webp';
import vineshCutout from '../../../assets/team/cutout/vinesh.webp';
import karupakCutout from '../../../assets/team/cutout/karupak.webp';
import akshayCutout from '../../../assets/team/cutout/akshay.webp';
import pawanCutout from '../../../assets/team/cutout/pawan.webp';
import karthikCutout from '../../../assets/team/cutout/karthik.webp';
import bharathCutout from '../../../assets/team/cutout/bharath.webp';

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

const CUTOUTS = {
  'sridhar-lendalay': sridharCutout,
  'palanati-lakshman': lakshmanCutout,
  'tv-arvind': aravindCutout,
  'manjula-lendalay': manjulaCutout,
  'ashok-kumar-shetty': ashokCutout,
  'vinesh-lendalay': vineshCutout,
  'beemanaboina-krupakar': karupakCutout,
  'akshay-kumar-nakka': akshayCutout,
  'pavan-gajjela': pawanCutout,
  'karthik-yadav': karthikCutout,
  'bharath-raj-lendalay': bharathCutout,
};

export function photoFor(slug) {
  return PHOTOS[slug] || null;
}

export function cutoutFor(slug) {
  return CUTOUTS[slug] || null;
}

export default PHOTOS;
