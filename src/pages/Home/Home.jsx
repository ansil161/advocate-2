import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Hero from './sections/Hero.jsx';
import Numbers from './sections/Numbers.jsx';
import Firm from './sections/Firm.jsx';
import Practice from './sections/Practice.jsx';
import Industries from './sections/Industries.jsx';
import Proof from './sections/Proof.jsx';
import Team from './sections/Team.jsx';
import Manifesto from './sections/Manifesto.jsx';
import ClientTestimonials from './sections/ClientTestimonials.jsx';
import './Home.css';

const CHAPTERS = ['hero', 'firm', 'practice', 'proof', 'team', 'manifesto', 'testimonials', 'consult'];

export default function Home() {
  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={CHAPTERS} dark />
      <Hero />
      <Numbers />
      <Firm />
      <Practice />
      <Industries />
      <Proof />
      <Team />
      <Manifesto />
      <ClientTestimonials />
      <Consult id="consult" />
    </Layout>
  );
}
