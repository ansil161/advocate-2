import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getPracticeBySlug } from '../../../data/practiceAreas.js';

const EASE = [0.16, 1, 0.3, 1];

// One page of the file replaces another: the sheet doesn't slide as a block,
// its parts arrive in reading order — reference, category, title, meta, body.
const doc = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.06 } },
  out: { transition: { staggerChildren: 0.02, staggerDirection: -1 } },
};
const line = {
  hidden: { opacity: 0, y: 18, filter: 'blur(5px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE } },
  out: { opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.3, ease: 'easeIn' } },
};
// The outcome lands like a stamp — pressed on, not faded in.
const stamp = {
  hidden: { opacity: 0, scale: 1.35, rotate: 9 },
  show: { opacity: 0.9, scale: 1, rotate: 3, transition: { duration: 0.55, ease: EASE, delay: 0.28 } },
  out: { opacity: 0, scale: 1.06, transition: { duration: 0.22 } },
};
const ghost = {
  hidden: { opacity: 0, scale: 1.06 },
  show: { opacity: 1, scale: 1, transition: { duration: 1.1, ease: EASE } },
  out: { opacity: 0, transition: { duration: 0.3 } },
};

export default function CaseDossier({ cases }) {
  const [active, setActive] = useState(0);
  const total = cases.length;
  const c = cases[active];
  const practice = getPracticeBySlug(c.practiceSlug);

  const go = useCallback(
    (i) => setActive(((i % total) + total) % total),
    [total],
  );

  // Arrow keys walk the index the way a tablist should; Home/End jump the file.
  const onKeyDown = useCallback(
    (e) => {
      const map = { ArrowDown: active + 1, ArrowRight: active + 1, ArrowUp: active - 1, ArrowLeft: active - 1, Home: 0, End: total - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = ((map[e.key] % total) + total) % total;
      setActive(next);
      document.getElementById(`cd-tab-${next}`)?.focus();
    },
    [active, total],
  );

  return (
    <div className="cd">
      {/* ── index rail ─────────────────────────────────────── */}
      <div className="cd-rail">
        <span className="cd-rail__label">Index</span>

        <div className="cd-rail__list" role="tablist" aria-orientation="vertical" aria-label="Landmark matters" onKeyDown={onKeyDown}>
          {cases.map((item, i) => (
            <button
              type="button"
              role="tab"
              id={`cd-tab-${i}`}
              key={item.n}
              aria-selected={i === active}
              aria-controls="cd-panel"
              tabIndex={i === active ? 0 : -1}
              className={`cd-tab ${i === active ? 'is-active' : ''}`}
              onClick={() => setActive(i)}
            >
              {i === active && (
                <motion.span
                  layoutId="cd-marker"
                  className="cd-tab__marker"
                  aria-hidden="true"
                  transition={{ duration: 0.5, ease: EASE }}
                />
              )}
              <span className="cd-tab__num">{item.n}</span>
              <span className="cd-tab__body">
                <span className="cd-tab__cat">{item.category}</span>
                <span className="cd-tab__forum">{item.forum}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="cd-rail__progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${(active + 1) / total})` }} />
        </div>
      </div>

      {/* ── the file ───────────────────────────────────────── */}
      <div className="cd-file" id="cd-panel" role="tabpanel" aria-labelledby={`cd-tab-${active}`}>
        <div className="cd-file__head">
          <span className="cd-file__ref">SLA / LMC / {c.n}</span>
          <span className="cd-file__count">
            <b>{c.n}</b> <i>/</i> {String(total).padStart(2, '0')}
          </span>
        </div>

        <div className="cd-file__sheet">
          <span className="cd-file__margin" aria-hidden="true" />

          <AnimatePresence mode="wait">
            <motion.article
              key={c.n}
              className="cd-doc"
              variants={doc}
              initial="hidden"
              animate="show"
              exit="out"
            >
              <motion.span className="cd-doc__ghost" variants={ghost} aria-hidden="true">{c.n}</motion.span>

              <motion.span className="cd-doc__stamp" variants={stamp} aria-hidden="true">
                {c.outcome}
              </motion.span>

              <motion.span className="cd-doc__cat" variants={line}>{c.category}</motion.span>
              <motion.h3 className="cd-doc__title" variants={line}>{c.title}</motion.h3>

              <motion.dl className="cd-doc__meta" variants={line}>
                <div>
                  <dt>Forum</dt>
                  <dd>{c.forum}</dd>
                </div>
                {practice && (
                  <div>
                    <dt>Practice Area</dt>
                    <dd>{practice.title}</dd>
                  </div>
                )}
                <div>
                  <dt>Outcome</dt>
                  <dd>{c.outcome}</dd>
                </div>
              </motion.dl>

              <motion.p className="cd-doc__summary" variants={line}>{c.summary}</motion.p>

              <motion.div className="cd-doc__withheld" variants={line}>
                <span className="cd-doc__redacted" aria-hidden="true"><i /><i /><i /></span>
                <span className="cd-doc__withheld-note">Further particulars withheld — client confidentiality</span>
              </motion.div>

              {practice && (
                <motion.div variants={line}>
                  <Link to={`/practice/${practice.slug}`} className="link-arrow cd-doc__link">
                    <span>View {practice.title}</span> →
                  </Link>
                </motion.div>
              )}
            </motion.article>
          </AnimatePresence>
        </div>

        <div className="cd-file__nav">
          <button type="button" className="cd-step" onClick={() => go(active - 1)}>
            <i aria-hidden="true">←</i>
            <span>
              <b>Previous</b>
              {cases[(active - 1 + total) % total].category}
            </span>
          </button>
          <button type="button" className="cd-step cd-step--next" onClick={() => go(active + 1)}>
            <span>
              <b>Next</b>
              {cases[(active + 1) % total].category}
            </span>
            <i aria-hidden="true">→</i>
          </button>
        </div>
      </div>
    </div>
  );
}
