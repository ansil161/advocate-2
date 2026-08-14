import { useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Icon, { PHILOSOPHY_ICONS } from '../../components/ui/Icon.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import AdvocateCard from './AdvocateCard.jsx';
import StackSection from '../../components/ui/StackSection.jsx';
import TeamArrival from './sections/TeamArrival.jsx';
import CounselStatement from './sections/CounselStatement.jsx';
import ExpertiseScroller from './sections/ExpertiseScroller.jsx';
import { useHashScroll } from '../../lib/useHashScroll.js';
import { team } from '../../data/team.js';
import { philosophy } from '../../data/firm.js';
import { practiceAreas } from '../../data/practiceAreas.js';
import cultureImg from '../../assets/img/bench-corridor.webp';
import './Team.css';

export default function TeamPage() {
  // Every advocate card carries `id={slug}`, which is what /team#<slug> from the
  // home page and from each practice page's lead-counsel link points at.
  useHashScroll();

  const featured = team.filter(t => t.featured);
  const rest = team.filter(t => !t.featured);

  const [openSlug, setOpenSlug] = useState(null);
  const returnRef = useRef(null);

  const { scrollYProgress: returnProgress } = useScroll({
    target: returnRef,
    offset: ['start end', 'end start'],
  });
  const returnScale = useTransform(returnProgress, [0, 0.5, 1], [0.94, 1, 0.94]);

  const toggleCard = useCallback(slug => {
    setOpenSlug(cur => (cur === slug ? null : slug));
  }, []);

  return (
    <Layout navTheme="dark">
      <PageMeta
        title="Our Team"
        description="Eleven advocates with seventy-five years of combined courtroom experience, every matter personally supervised by Senior Advocate Sridhar Lendalay."
        path="/team"
      />
      <div className="t-stackRoot">
        <TeamArrival />

        <StackSection id="t-bench" className="t-panel t-panel--cream" depth={1}>
          <div className="container t-bench">
            <div className="t-bench__head">
              <span className="eyebrow eyebrow--num">Eleven Advocates</span>
              <h2 className="h2"><SplitText text="Who you will actually be sitting across from." /></h2>
            </div>
            <div className="t-bench__featured">
              {featured.map(a => (
                <AdvocateCard
                  advocate={a}
                  large
                  key={a.slug}
                  open={openSlug === a.slug}
                  onToggle={toggleCard}
                />
              ))}
            </div>
            <div className="t-bench__grid">
              {rest.map((a, i) => (
                <AdvocateCard
                  advocate={a}
                  delay={(i % 3) * 0.06}
                  key={a.slug}
                  open={openSlug === a.slug}
                  onToggle={toggleCard}
                />
              ))}
            </div>
          </div>
        </StackSection>

        <StackSection id="t-standard" className="t-panel t-panel--dark" depth={2} dim={0.4}>
          <CounselStatement />
        </StackSection>

        <StackSection id="t-culture" className="t-panel t-panel--deep" depth={3}>
          <div className="t-culture__wash" aria-hidden="true">
            <img src={cultureImg} alt="" loading="lazy" />
          </div>
          <div className="container t-culture__grid">
            <span className="chapter-label"><Icon name="hand" /> <b>Culture</b></span>
            <div>
              <h2 className="h2"><SplitText text={philosophy.title} /></h2>
              <Reveal as="p" className="lede">{philosophy.statement}</Reveal>
              <div className="t-culture__points">
                {philosophy.points.map((pt, i) => (
                  <Reveal as="div" className="t-culture__point" key={pt.title} delay={i * 0.08}>
                    <span className="t-culture__point-num"><Icon name={PHILOSOPHY_ICONS[i]} /></span>
                    <h4>{pt.title}</h4>
                    <p>{pt.body}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </StackSection>

        {/* Not pinned: this panel owns an inner position:sticky track, and a
            sticky ancestor would become its containing block and break it. */}
        <StackSection id="t-expertise" className="t-panel t-panel--black t-expertise" depth={4} pin={false}>
          <div className="container t-expertise__head">
            <span className="eyebrow eyebrow--light"><SplitText text="Expertise Map" /></span>
            <h2 className="h2 h2--light"><SplitText text="Twelve domains, one bench." /></h2>
          </div>
          <ExpertiseScroller items={practiceAreas} />
        </StackSection>
      </div>

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
