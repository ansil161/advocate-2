import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from '../../components/shell/Layout.jsx';
import ChapterSpine from '../../components/shell/ChapterSpine.jsx';
import Consult from '../../components/shell/Consult.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import PracticeArrival from './sections/PracticeArrival.jsx';
import PracticeCinematic from './sections/PracticeCinematic.jsx';
import { practiceAreas, getPracticeBySlug } from '../../data/practiceAreas.js';
import { team } from '../../data/team.js';
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

// Two fixed lists rather than one built per render: several practice areas carry
// no FAQ, and a spine numbered for a section that isn't in the document leaves a
// rail entry that can never light up and can never be scrolled to.
const CHAPTERS = ['pd-arrival', 'pd-matter', 'pd-approach', 'pd-chamber', 'pd-counsel', 'pd-related', 'pd-faq'];
const CHAPTERS_NO_FAQ = CHAPTERS.slice(0, -1);
// The first four chapters play on black; the rail has to invert with them and
// then go back to ink for the editorial half of the page. Both lists are module
// scope so the spine's observer isn't torn down and rebuilt on every render.
const DARK_CHAPTERS = ['pd-arrival', 'pd-matter', 'pd-approach', 'pd-chamber'];

export default function PracticeDetail() {
  const { slug } = useParams();
  const p = getPracticeBySlug(slug);
  if (!p) return <Navigate to="/practice" replace />;

  const lead = team.find(t => t.featured) || team[0];
  const related = practiceAreas.filter(x => x.slug !== p.slug).slice(0, 3);

  return (
    <Layout navTheme="dark">
      <ChapterSpine sectionIds={p.faq.length > 0 ? CHAPTERS : CHAPTERS_NO_FAQ} darkIds={DARK_CHAPTERS} />

      {/* Keyed on the slug: moving between two practice areas re-mounts the
          camera rather than re-pointing it, so no timeline outlives its data. */}
      <PracticeArrival practice={p} key={`arrival-${p.slug}`} />

      {/* 01 The Matter · 02 The Approach · 03 The Chamber — one continuous take */}
      <PracticeCinematic practice={p} key={`cinematic-${p.slug}`} />

      {/* LeadCounsel — the sequence ends, and the page becomes a person */}
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
