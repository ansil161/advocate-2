import { Suspense, lazy } from 'react';
import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Numbers from './sections/Numbers.jsx';
import Firm from './sections/Firm.jsx';
import Practice from './sections/Practice.jsx';
import Industries from './sections/Industries.jsx';
import Proof from './sections/Proof.jsx';
import Team from './sections/Team.jsx';
import Manifesto from './sections/Manifesto.jsx';
import ClientTestimonials from './sections/ClientTestimonials.jsx';
import './Home.css';

// The cinematic hero carries Three.js with it. Splitting it out keeps
// it off the critical path — the rest of the page parses and paints
// while the world loads behind the hero's own entrance card.
const HeroExperience = lazy(() => import('../../components/hero/cinematic/HeroExperience.jsx'));

export default function Home() {
  return (
    <Layout navTheme="dark">
      <PageMeta
        description="SLA Advocates — a Hyderabad-based full-service litigation and advisory firm led by Senior Advocate Sridhar Lendalay. 30+ years at the Bar, 2000+ cases handled, a 75%+ success rate."
        path="/"
      />
      <Suspense fallback={<div className="chero-placeholder" id="hero" />}>
        <HeroExperience />
      </Suspense>
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
