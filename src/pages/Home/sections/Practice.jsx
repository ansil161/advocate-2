import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { practiceAreas } from '../../../data/practiceAreas.js';

export default function Practice() {
  const [active, setActive] = useState(0);
  const p = practiceAreas[active];

  return (
    <section className="practice" id="practice">
      <div className="container">
        <div className="section-head section-head--split">
          <div>
            <span className="eyebrow"><SplitText text="Practice Areas" /></span>
            <h2 className="h2">
              <SplitText text="Twelve domains." as="div" />
              <SplitText text="One disciplined approach." as="div" />
            </h2>
          </div>
          <Reveal as="p" className="section-head__note">
            From civil recovery to constitutional writs — matters typically handled
            before Civil Courts, Criminal Courts, the High Court, NCLT, DRT,
            Consumer Commissions, Labour Courts and various Tribunals across India.
          </Reveal>
        </div>

        <div className="practice__browser">
          <div className="practice__list">
            {practiceAreas.map((row, i) => (
              <div
                key={row.slug}
                className={`practice__row ${i === active ? 'is-active' : ''}`}
                onMouseEnter={() => setActive(i)}
              >
                <span className="practice__row-num">{row.n}</span>
                <span className="practice__row-title">{row.title}</span>
                <span className="practice__row-arrow">→</span>
              </div>
            ))}
          </div>

          <div className="practice__detail">
            <AnimatePresence mode="wait">
              <motion.div
                key={p.slug}
                className="practice__detail-inner"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="practice__detail-num">{p.n}</div>
                <h3 className="practice__detail-title">{p.title}</h3>
                <p className="practice__detail-desc">{p.short}</p>
                <div className="practice__detail-tags">
                  {p.tags.slice(0, 5).map(t => <span key={t}>{t}</span>)}
                </div>
                <Link to={`/practice/${p.slug}`} className="link-arrow"><span>View this practice area</span> →</Link>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
