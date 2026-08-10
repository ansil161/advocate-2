import { Suspense, lazy, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Preloader from './components/shell/Preloader.jsx';
import Cursor from './components/shell/Cursor.jsx';
import PageReveal from './components/shell/PageReveal.jsx';
import { useLenis } from './lib/useLenis.js';

import Home from './pages/Home/Home.jsx';

// Home ships eagerly (it's the primary landing page); everything else is
// code-split per route to keep the initial bundle lean.
const About = lazy(() => import('./pages/About/About.jsx'));
const PracticeAreas = lazy(() => import('./pages/PracticeAreas/PracticeAreas.jsx'));
const PracticeDetail = lazy(() => import('./pages/PracticeAreas/PracticeDetail.jsx'));
const TeamPage = lazy(() => import('./pages/Team/TeamPage.jsx'));
const IndustryDetail = lazy(() => import('./pages/IndustryDetail/IndustryDetail.jsx'));
const Awards = lazy(() => import('./pages/Awards/Awards.jsx'));
const LandmarkCases = lazy(() => import('./pages/LandmarkCases/LandmarkCases.jsx'));
const Contact = lazy(() => import('./pages/Contact/Contact.jsx'));

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useLenis();

  return (
    <>
      <Preloader onDone={() => setLoaded(true)} />
      <Cursor />
      <PageReveal />
      <div style={{ visibility: loaded ? 'visible' : 'hidden' }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/practice" element={<PracticeAreas />} />
            <Route path="/practice/:slug" element={<PracticeDetail />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/industries/:slug" element={<IndustryDetail />} />
            <Route path="/awards" element={<Awards />} />
            <Route path="/landmark-cases" element={<LandmarkCases />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}
