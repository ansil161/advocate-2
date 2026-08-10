import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import SplitText from '../../../components/ui/SplitText.jsx';
import Hero3D from '../../../components/ui/Hero3D.jsx';
import heroImg from '../../../assets/img/hero-courthouse.webp';

export default function Hero() {
  return (
    <section className="home-hero" id="hero">
      <div className="home-hero__media">
        <motion.img
          src={heroImg}
          alt=""
          className="home-hero__img"
          initial={{ scale: 1.12 }}
          animate={{ scale: 1.04 }}
          transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="home-hero__scrim" />
      </div>
      <Hero3D className="home-hero__canvas" />
      <div className="home-hero__grain" />

      <div className="home-hero__content container">
        <span className="eyebrow" style={{ overflow: 'hidden', display: 'block' }}>
          <SplitText text="Hyderabad · Full-Service Litigation & Advisory" stagger={0.02} />
        </span>
        <h1 className="home-hero__title">
          <SplitText text="Justice pursued." as="div" delay={0.15} />
          <SplitText text="Recovery executed." as="div" className="home-hero__title--em" delay={0.35} />
        </h1>
        <motion.p
          className="home-hero__sub"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          Thirty years of courtroom mastery, a team with over seventy-five years of
          combined experience, and a practice built on one principle — favourable
          orders mean nothing without real execution.
        </motion.p>
        <motion.div
          className="home-hero__cta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 1.05, ease: [0.16, 1, 0.3, 1] }}
        >
          <Link to="/contact" className="btn btn--solid magnetic"><span>Book a Consultation</span></Link>
          <Link to="/practice" className="btn btn--line home-hero__line magnetic"><span>Explore Practice Areas</span></Link>
        </motion.div>
      </div>

      <motion.div
        className="home-hero__scroll"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.3 }}
      >
        <span>Scroll</span>
        <div className="home-hero__scroll-line"><i /></div>
      </motion.div>
    </section>
  );
}
