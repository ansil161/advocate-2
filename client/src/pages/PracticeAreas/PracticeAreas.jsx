import { Link } from 'react-router-dom';
import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Icon, { practiceIcon } from '../../components/ui/Icon.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import { practiceAreas } from '../../data/practiceAreas.js';
import bgImg from '../../assets/img/colonnade-diagonal.webp';
import bgImg760 from '../../assets/img/colonnade-diagonal-760.webp';
import './PracticeAreas.css';

export default function PracticeAreas() {
  return (
    <Layout navTheme="dark">
      <PageMeta
        title="Practice Areas"
        description="Twelve practice domains — civil, criminal, constitutional, corporate, banking, insolvency, tax, labour, IP, real estate, family and consumer law — before courts and tribunals across Telangana."
        path="/practice"
      />
      <section className="pa-hero" id="pa-hero">
        {/* Full-bleed decorative layer; the original stays the widest candidate. */}
        <div className="pa-hero__bg" aria-hidden="true">
          <img
            src={bgImg}
            srcSet={`${bgImg760} 760w, ${bgImg} 1600w`}
            sizes="100vw"
            alt=""
          />
        </div>
        <div className="container pa-hero__content">
          <span className="chapter-label chapter-label--light"><Icon name="grid" /> <b>Practice Areas</b> — Twelve Domains</span>
          <h1 className="h1 h2--light">
            <SplitText text="Twelve domains." as="div" />
            <SplitText text="One disciplined approach." as="div" />
          </h1>
          <Reveal as="p" className="pa-hero__sub">
            SLA Advocates is a full-service litigation and advisory firm with practice
            spanning civil, criminal, constitutional, corporate, banking, tax, labour,
            IP, real estate, family and consumer law — matters typically handled before
            Civil Courts, Criminal Courts, the High Court, NCLT, DRT, Consumer Commissions,
            Labour Courts and various Tribunals across India.
          </Reveal>
        </div>
      </section>

      <section className="pa-index" id="pa-index">
        <div className="container">
          <div className="pa-index__grid">
            {practiceAreas.map((p, i) => (
              <Reveal as={Link} to={`/practice/${p.slug}`} className="pa-card" key={p.slug} delay={(i % 3) * 0.06}>
                <span className="pa-card__num"><Icon name={practiceIcon(p.slug)} /></span>
                <h3 className="pa-card__title">{p.title}</h3>
                <p className="pa-card__desc">{p.short}</p>
                <span className="pa-card__link">Explore <span aria-hidden="true">→</span></span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Consult />
    </Layout>
  );
}
