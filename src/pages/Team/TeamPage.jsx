import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import AdvocateCard from './AdvocateCard.jsx';
import ExpertiseScroller from './sections/ExpertiseScroller.jsx';
import { team } from '../../data/team.js';
import { philosophy } from '../../data/firm.js';
import { practiceAreas } from '../../data/practiceAreas.js';
import heroImg from '../../assets/img/library-moody.webp';
import './Team.css';

const CHAPTERS = ['t-arrival', 't-bench', 't-culture', 't-expertise', 't-return'];

export default function TeamPage() {
  const featured = team.filter(t => t.featured);
  const rest = team.filter(t => !t.featured);

  const heroRef = useRef(null);
  const returnRef = useRef(null);

  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgScale = useTransform(heroProgress, [0, 1], [1, 1.18]);
  const bgY = useTransform(heroProgress, [0, 1], ['0%', '14%']);
  const heroFade = useTransform(heroProgress, [0, 0.8], [1, 0]);

  const { scrollYProgress: returnProgress } = useScroll({ target: returnRef, offset: ['start end', 'end start'] });
  const returnScale = useTransform(returnProgress, [0, 0.5, 1], [0.94, 1, 0.94]);

  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={CHAPTERS} dark />

      <section className="t-arrival" id="t-arrival" ref={heroRef}>
        <motion.div className="t-arrival__bg" aria-hidden="true" style={{ scale: bgScale, y: bgY }}>
          <img src={heroImg} alt="" />
        </motion.div>
        <motion.div className="container t-arrival__content" style={{ opacity: heroFade }}>
          <span className="chapter-label chapter-label--light"><b>The Team</b> — Eleven Advocates</span>
          <h1 className="h1 h2--light">
            <SplitText text="Seventy-five years," as="div" />
            <SplitText text="under one roof." as="div" />
          </h1>
          <Reveal as="p" className="t-arrival__sub">
            A dedicated bench of legal professionals consolidating a combined
            seventy-five-plus years of courtroom experience — every matter
            personally supervised by Senior Advocate Sridhar Lendalay.
          </Reveal>
        </motion.div>
      </section>

      <section className="t-bench" id="t-bench">
        <div className="container">
          <div className="t-bench__featured">
            {featured.map((a, i) => (
              <AdvocateCard advocate={a} large index={i} key={a.slug} />
            ))}
          </div>
          <div className="t-bench__grid">
            {rest.map((a, i) => (
              <AdvocateCard advocate={a} index={featured.length + i} delay={(i % 3) * 0.06} key={a.slug} />
            ))}
          </div>
        </div>
      </section>

      <section className="t-culture" id="t-culture">
        <div className="container t-culture__grid">
          <span className="chapter-label"><b>Culture</b></span>
          <div>
            <h2 className="h2"><SplitText text={philosophy.title} /></h2>
            <Reveal as="p" className="lede">{philosophy.statement}</Reveal>
            <div className="t-culture__points">
              {philosophy.points.map((pt, i) => (
                <Reveal as="div" className="t-culture__point" key={pt.title} delay={i * 0.08}>
                  <span className="t-culture__point-num">{String(i + 1).padStart(2, '0')}</span>
                  <h4>{pt.title}</h4>
                  <p>{pt.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="t-expertise" id="t-expertise">
        <div className="container t-expertise__head">
          <span className="eyebrow eyebrow--light"><SplitText text="Expertise Map" /></span>
          <h2 className="h2 h2--light"><SplitText text="Twelve domains, one bench." /></h2>
          <span className="t-expertise__cue">Scroll</span>
        </div>
        <ExpertiseScroller items={practiceAreas} />
      </section>

      <section className="t-return" id="t-return" ref={returnRef}>
        <motion.div className="container" style={{ scale: returnScale }}>
          <Reveal as="p" className="t-return__text">
            Eleven advocates. One personally supervised standard. If your matter
            needs a bench, not just a lawyer — this is it.
          </Reveal>
          <Reveal delay={0.1}>
            <Link to="/about" className="link-arrow"><span>Read our full story</span> →</Link>
          </Reveal>
        </motion.div>
      </section>

      <Consult />
    </Layout>
  );
}
