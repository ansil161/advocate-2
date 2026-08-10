import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import CredentialStats from './sections/CredentialStats.jsx';
import BarCouncilRail from './sections/BarCouncilRail.jsx';
import CourtsScroller from './sections/CourtsScroller.jsx';
import MilestoneTimeline from './sections/MilestoneTimeline.jsx';
import { credentials, barCouncilEnrollments, milestones, recognitionQuote } from '../../data/awards.js';
import bgImg from '../../assets/img/colonnade-diagonal.webp';
import './Awards.css';

const CHAPTERS = ['aw-hero', 'aw-wall', 'aw-quote', 'aw-bar', 'aw-courts', 'aw-milestones'];
const FORUMS = ['High Court of Telangana', 'City Civil Courts, Hyderabad', 'District Courts', 'Debt Recovery Tribunal (DRT)', 'NCLT', 'Consumer Commissions', 'Labour Courts'];

export default function Awards() {
  const heroRef = useRef(null);
  const quoteRef = useRef(null);

  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgScale = useTransform(heroProgress, [0, 1], [1, 1.18]);
  const bgY = useTransform(heroProgress, [0, 1], ['0%', '14%']);
  const heroFade = useTransform(heroProgress, [0, 0.8], [1, 0]);

  const { scrollYProgress: quoteProgress } = useScroll({ target: quoteRef, offset: ['start end', 'end start'] });
  const quoteScale = useTransform(quoteProgress, [0, 0.5, 1], [0.92, 1, 0.92]);

  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={CHAPTERS} dark />

      <section className="aw-hero" id="aw-hero" ref={heroRef}>
        <motion.div className="aw-hero__bg" aria-hidden="true" style={{ scale: bgScale, y: bgY }}>
          <img src={bgImg} alt="" />
        </motion.div>
        <motion.div className="container aw-hero__content" style={{ opacity: heroFade }}>
          <span className="chapter-label chapter-label--light"><b>Recognition</b> &amp; Credentials</span>
          <h1 className="h1 h2--light">
            <SplitText text="Standing built on record," as="div" />
            <SplitText text="not marketing." as="div" />
          </h1>
          <Reveal as="p" className="aw-hero__sub">
            Enrolled with the Bar Council of Telangana, with regular appearances
            before the High Court, City Civil Courts, DRT and NCLT — our credibility
            is measured in outcomes.
          </Reveal>
        </motion.div>
      </section>

      <section className="aw-wall" id="aw-wall">
        <div className="container">
          <CredentialStats items={credentials} />
        </div>
      </section>

      <section className="aw-quote" id="aw-quote" ref={quoteRef}>
        <motion.div className="container" style={{ scale: quoteScale }}>
          <Reveal as="p" className="aw-quote__text">
            <SplitText text={`"${recognitionQuote.quote}"`} stagger={0.02} />
          </Reveal>
          <Reveal as="p" className="aw-quote__attr" delay={0.3}>— {recognitionQuote.attribution}</Reveal>
        </motion.div>
      </section>

      <section className="aw-bar" id="aw-bar">
        <div className="container">
          <span className="chapter-label"><b>Bar Council</b> of Telangana</span>
          <h2 className="h2" style={{ marginBottom: '2rem' }}><SplitText text="Enrolled advocates." /></h2>
          <BarCouncilRail rows={barCouncilEnrollments} />
        </div>
      </section>

      <section className="aw-courts" id="aw-courts">
        <div className="container aw-courts__head">
          <span className="chapter-label chapter-label--light"><b>Regular Appearances</b></span>
          <h2 className="h2 h2--light"><SplitText text="Where we practice, consistently." /></h2>
          <span className="aw-courts__cue">Scroll</span>
        </div>
        <CourtsScroller items={FORUMS} />
      </section>

      <section className="aw-milestones" id="aw-milestones">
        <div className="container">
          <span className="chapter-label"><b>Milestones</b></span>
          <h2 className="h2" style={{ marginBottom: '2.5rem' }}><SplitText text="Three decades, in brief." /></h2>
          <MilestoneTimeline items={milestones} />
        </div>
      </section>

      <Consult />
    </Layout>
  );
}
