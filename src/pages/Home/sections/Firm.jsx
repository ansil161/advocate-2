import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { firmStory } from '../../../data/firm.js';
import aboutImg from '../../../assets/img/about-colonnade.webp';

export default function Firm() {
  return (
    <section className="firm" id="firm">
      <div className="container firm__grid">
        <motion.div
          className="firm__media"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={aboutImg} alt="Marble colonnade, symbolic of judicial architecture" />
          <div className="firm__media-frame" />
          <div className="firm__media-tag">
            <span className="firm__media-tag-num">30+</span>
            <span className="firm__media-tag-txt">Years at the Bar</span>
          </div>
        </motion.div>

        <div className="firm__text">
          <span className="eyebrow"><SplitText text={firmStory.eyebrow} /></span>
          <h2 className="h2">
            <SplitText text="A full-service litigation firm," as="div" />
            <SplitText text="personally supervised." as="div" />
          </h2>
          <Reveal as="p" className="lede">{firmStory.paragraphs[0]}</Reveal>
          <Reveal as="p" delay={0.08}>{firmStory.paragraphs[2]}</Reveal>
          <Reveal className="firm__founder" delay={0.14}>
            <div className="firm__founder-sig">Sridhar Lendalay</div>
            <div className="firm__founder-role">Senior Advocate &amp; Founder, SLA Advocates</div>
          </Reveal>
          <Reveal delay={0.2}>
            <Link to="/about" className="link-arrow"><span>Read our full story</span> →</Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
