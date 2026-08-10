import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import { practiceAreas, getPracticeBySlug } from '../../data/practiceAreas.js';
import { team } from '../../data/team.js';
import heroImg from '../../assets/img/hero-courthouse.webp';
import './PracticeAreas.css';

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`pfaq__item ${open ? 'is-open' : ''}`}>
      <button className="pfaq__q" onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className="pfaq__toggle">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="pfaq__a-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="pfaq__a">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PracticeDetail() {
  const { slug } = useParams();
  const p = getPracticeBySlug(slug);
  if (!p) return <Navigate to="/practice" replace />;

  const lead = team.find(t => t.featured) || team[0];
  const related = practiceAreas.filter(x => x.slug !== p.slug).slice(0, 3);
  const CHAPTERS = ['pd-arrival', 'pd-matter', 'pd-approach', 'pd-chamber', 'pd-counsel', 'pd-related', 'pd-faq'];

  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={CHAPTERS} dark />

      {/* PracticeArrival */}
      <section className="pd-arrival" id="pd-arrival">
        <div className="pd-arrival__bg" aria-hidden="true"><img src={heroImg} alt="" /></div>
        <div className="container pd-arrival__content">
          <span className="chapter-label chapter-label--light"><b>{p.n}</b> / 12 — Practice Areas</span>
          <h1 className="h1 h2--light"><SplitText text={p.title} /></h1>
          <Reveal as="p" className="pd-arrival__sub">{p.short}</Reveal>
        </div>
      </section>

      {/* TheMatter */}
      <section className="pd-block" id="pd-matter">
        <div className="container pd-block__grid">
          <span className="chapter-label"><b>01</b> The Matter</span>
          <div>
            <h2 className="h2"><SplitText text="What this practice covers." /></h2>
            <Reveal as="p" className="lede">{p.matter}</Reveal>
          </div>
        </div>
      </section>

      {/* TheApproach */}
      <section className="pd-block pd-block--alt" id="pd-approach">
        <div className="container pd-block__grid">
          <span className="chapter-label"><b>02</b> The Approach</span>
          <div>
            <h2 className="h2"><SplitText text="How we build the case." /></h2>
            <Reveal as="p" className="lede">{p.approach}</Reveal>
            <div className="pd-tags">
              {p.tags.map(t => <span key={t}>{t}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* TheChamber */}
      <section className="pd-block" id="pd-chamber">
        <div className="container pd-block__grid">
          <span className="chapter-label"><b>03</b> The Chamber</span>
          <div>
            <h2 className="h2"><SplitText text="Where these matters are heard." /></h2>
            <div className="pd-forums">
              {p.forums.map((f, i) => (
                <Reveal as="div" className="pd-forum" key={f} delay={i * 0.06}>
                  <span>{String(i + 1).padStart(2, '0')}</span>{f}
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* LeadCounsel */}
      <section className="pd-block pd-block--alt" id="pd-counsel">
        <div className="container pd-counsel">
          <span className="chapter-label"><b>04</b> Lead Counsel</span>
          <Reveal className="pd-counsel__card">
            <div className="card-adv" data-initials={lead.initials} style={{ background: 'var(--black)' }}>
              <div className="card-adv__exp">{lead.exp}</div>
              <div className="card-adv__name">{lead.name}</div>
              <div className="card-adv__role">{lead.role}</div>
              <p className="card-adv__bio">{lead.bio}</p>
            </div>
            <Link to={`/team#${lead.slug}`} className="link-arrow"><span>View full profile</span> →</Link>
          </Reveal>
        </div>
      </section>

      {/* RelatedAreas */}
      <section className="pd-block" id="pd-related">
        <div className="container">
          <span className="chapter-label"><b>05</b> Related Areas</span>
          <div className="pd-related__grid">
            {related.map((r, i) => (
              <Reveal as={Link} to={`/practice/${r.slug}`} className="pa-card" key={r.slug} delay={i * 0.08}>
                <span className="pa-card__num">{r.n}</span>
                <h3 className="pa-card__title">{r.title}</h3>
                <p className="pa-card__desc">{r.short}</p>
                <span className="pa-card__link">Explore <span aria-hidden="true">→</span></span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PracticeFAQ */}
      {p.faq.length > 0 && (
        <section className="pd-block pd-block--alt" id="pd-faq">
          <div className="container">
            <span className="chapter-label"><b>06</b> Questions</span>
            <h2 className="h2" style={{ marginBottom: '2rem' }}><SplitText text="Frequently asked." /></h2>
            <div className="pfaq">
              {p.faq.map(f => <FAQItem key={f.q} {...f} />)}
            </div>
          </div>
        </section>
      )}

      {/* PracticeIndex */}
      <section className="pd-block">
        <div className="container">
          <Link to="/practice" className="link-arrow"><span>Back to all practice areas</span> →</Link>
        </div>
      </section>

      <Consult />
    </Layout>
  );
}
