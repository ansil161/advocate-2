import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';
import Hero3D from '../../../components/ui/Hero3D.jsx';
import justiceImg from '../../../assets/img/justice-statue.webp';
import portraitImg from '../../../assets/img/about-colonnade.webp';

const EASE = [0.16, 1, 0.3, 1];

export default function AboutHero() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });

  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section className="a-hero" id="a-hero" ref={sectionRef}>
      <motion.div className="a-hero__bg" style={{ scale: bgScale, y: bgY }}>
        <motion.img
          src={justiceImg}
          alt=""
          className="a-hero__bg-img"
          initial={{ opacity: 1, scale: 1.15 }}
          animate={{ opacity: 0, scale: 1.04 }}
          transition={{ opacity: { duration: 1, delay: 1.5, ease: EASE }, scale: { duration: 3, ease: 'easeOut' } }}
        />
        <motion.img
          src={portraitImg}
          alt="Marble colonnade, symbolic of judicial architecture"
          className="a-hero__bg-img"
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 1, scale: 1.05 }}
          transition={{ opacity: { duration: 1, delay: 1.5, ease: EASE }, scale: { duration: 8, delay: 1.5, ease: 'easeOut' } }}
        />
      </motion.div>
      <div className="a-hero__scrim" />
      <Hero3D className="a-hero__canvas" />
      <div className="a-hero__grain" />

      <motion.div className="container a-hero__content" style={{ opacity: fade }}>
        <motion.span
          className="chapter-label chapter-label--light"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
        >
          <b>Founded 2013</b> — Hyderabad
        </motion.span>
        <h1 className="a-hero__title">
          <SplitText text="A judgment is only as good" as="div" delay={0.5} />
          <SplitText text="as its execution." as="div" className="a-hero__title--em" delay={0.7} />
        </h1>
      </motion.div>

      <motion.div
        className="a-hero__scroll"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
      >
        <span>Scroll</span>
        <div className="a-hero__scroll-line"><i /></div>
      </motion.div>
    </section>
  );
}
