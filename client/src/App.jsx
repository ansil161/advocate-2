import { Suspense, lazy, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Preloader from './components/shell/Preloader.jsx';
import Cursor from './components/shell/Cursor.jsx';
import PageReveal from './components/shell/PageReveal.jsx';
import ErrorBoundary from './components/shell/ErrorBoundary.jsx';
import { useLenis } from './lib/useLenis.js';
import { AppReadyContext } from './lib/appReady.js';

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
const NotFound = lazy(() => import('./pages/NotFound/NotFound.jsx'));

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useLenis();

  return (
    <>
      <Preloader onDone={() => setLoaded(true)} />
      <Cursor />
      <PageReveal />
      {/* The site is rendered but hidden until the preloader lifts, so anything
          whose entrance is the point has to be told when it is actually on
          screen — see lib/appReady.js. */}
      <AppReadyContext.Provider value={loaded}>
      <div style={{ visibility: loaded ? 'visible' : 'hidden' }}>
        {/* Wraps the routes only. Everything a page needs to be a page — Nav,
            Footer, the CTA — is inside Layout and therefore inside this, so the
            fallback carries its own way out. See ErrorBoundary.jsx. */}
        <ErrorBoundary>
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
      </AppReadyContext.Provider>
    </>
  );
}
