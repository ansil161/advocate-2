import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getPracticeBySlug } from '../../../data/practiceAreas.js';

const EASE = [0.16, 1, 0.3, 1];

export default function CaseDossier({ cases }) {
  const [active, setActive] = useState(0);
  const c = cases[active];
  const practice = getPracticeBySlug(c.practiceSlug);

  return (
    <div className="cd-wrap">
      <motion.div
        className="cd-cover"
        initial={{ scaleY: 1 }}
        whileInView={{ scaleY: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 1.1, delay: 0.15, ease: EASE }}
        aria-hidden="true"
      >
        <div className="cd-cover__seal"><span>SLA</span></div>
        <p className="cd-cover__label">Case File — Landmark Matters</p>
      </motion.div>

      <div className="cd-grid">
        <div className="cd-tabs">
          {cases.map((item, i) => (
            <button
              type="button"
              key={item.n}
              className={`cd-tab ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              <span className="cd-tab__num">{item.n}</span>
              <span className="cd-tab__cat">{item.category}</span>
            </button>
          ))}
        </div>

        <div className="cd-page-frame">
          <span className="cd-page-frame__index">{c.n} / {String(cases.length).padStart(2, '0')}</span>
          <AnimatePresence mode="wait">
            <motion.div
              key={c.n}
              className="cd-page"
              initial={{ opacity: 0, x: 28, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -28, filter: 'blur(6px)' }}
              transition={{ duration: 0.55, ease: EASE }}
            >
              <span className="cd-page__stamp">{c.outcome}</span>
              <span className="cd-page__cat">{c.category}</span>
              <h3 className="cd-page__title">{c.title}</h3>

              <div className="cd-page__meta">
                <div><span>Forum</span>{c.forum}</div>
                {practice && <div><span>Practice Area</span>{practice.title}</div>}
              </div>

              <p className="cd-page__summary">{c.summary}</p>

              <div className="cd-page__redacted" aria-hidden="true"><span /><span /><span /></div>

              {practice && (
                <Link to={`/practice/${practice.slug}`} className="link-arrow cd-page__link">
                  <span>View {practice.title}</span> →
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
