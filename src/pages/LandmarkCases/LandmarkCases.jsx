import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import CaseDossier from './sections/CaseDossier.jsx';
import { landmarkCases, disclaimer } from '../../data/landmarkCases.js';
import bgImg from '../../assets/img/bookshelf-mono.webp';
import './LandmarkCases.css';

export default function LandmarkCases() {
  const heroRef = useRef(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgScale = useTransform(heroProgress, [0, 1], [1, 1.18]);
  const bgY = useTransform(heroProgress, [0, 1], ['0%', '14%']);
  const heroFade = useTransform(heroProgress, [0, 0.8], [1, 0]);

  return (
    <Layout navTheme="dark">
      <section className="lc-hero" id="lc-hero" ref={heroRef}>
        <motion.div className="lc-hero__bg" aria-hidden="true" style={{ scale: bgScale, y: bgY }}>
          <img src={bgImg} alt="" />
        </motion.div>
        <motion.div className="container lc-hero__content" style={{ opacity: heroFade }}>
          <span className="chapter-label chapter-label--light"><b>Landmark Cases</b></span>
          <h1 className="h1 h2--light">
            <SplitText text="A record built" as="div" />
            <SplitText text="matter by matter." as="div" />
          </h1>
          <Reveal as="p" className="lc-hero__sub">{disclaimer}</Reveal>
        </motion.div>
      </section>

      <section className="lc-archive" id="lc-archive">
        <div className="container">
          <CaseDossier cases={landmarkCases} />
        </div>
      </section>

      <Consult />
    </Layout>
  );
}
