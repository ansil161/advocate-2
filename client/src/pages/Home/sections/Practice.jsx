import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Reveal from '../../../components/ui/Reveal.jsx';
import { practiceAreas } from '../../../data/practiceAreas.js';
import { principles } from '../../../data/firm.js';

import plateVolumes from '../../../assets/img/bench-desk.webp';
import plateCourthouse from '../../../assets/img/hero-courthouse.webp';
import plateStatue from '../../../assets/img/justice-statue.webp';
import plateStone from '../../../assets/img/columns-abstract.webp';
import plateArchive from '../../../assets/img/bookshelf-mono.webp';
import plateLibrary from '../../../assets/img/library-moody.webp';
import plateColumns from '../../../assets/img/bench-corridor.webp';
import plateCarved from '../../../assets/img/bench-chambers.webp';
import plateColonnade from '../../../assets/img/colonnade-diagonal.webp';
import plateChairs from '../../../assets/img/bench-table.webp';

// Every plate is an existing project asset — real architecture and real
// interiors, none of it captioned as an SLA premises or as a named court. The
// alt text describes the photograph, not the practice: the practice is already
// named in the display line beside it.
//
// Two assets are deliberately absent, for the same reasons the practice pages
// leave them out (see PracticeAreas/lib/practiceImagery.js): sla-building.webp,
// because that is the firm's own premises and pairing it with a domain would
// read as a claim about the domain; and about-colonnade.webp, because the Firm
// section directly above on this same page is already that photograph.
//
// Ten plates across twelve domains, so two repeat — each pair set as far apart
// in the list as the mapping allows, since only neighbours are seen together.
const PLATES = {
  'civil-litigation': { src: plateVolumes, alt: 'Gold-tooled leather law volumes ranked on a shelf' },
  'criminal-law': { src: plateCourthouse, alt: 'Courthouse portico beneath a darkening sky' },
  'constitutional-writ-practice': { src: plateStatue, alt: 'Statue of Justice holding the scales' },
  'corporate-commercial-law': { src: plateStone, alt: 'Marble pilasters of an institutional facade' },
  'banking-financial-laws': { src: plateArchive, alt: 'Bound ledgers ranked along an archive shelf' },
  'insolvency-bankruptcy': { src: plateLibrary, alt: 'Upper gallery of a darkened law library' },
  'taxation-laws': { src: plateVolumes, alt: 'Gold-tooled leather law volumes ranked on a shelf' },
  'labour-employment-law': { src: plateColumns, alt: 'Ranked stone columns in raking light' },
  'intellectual-property-rights': { src: plateCarved, alt: 'Carved bookcase lit by a chamber sconce' },
  'real-estate-infrastructure': { src: plateColonnade, alt: 'Colonnade of a civic building, seen along its length' },
  'family-succession-matters': { src: plateChairs, alt: 'Quiet consultation corner with leather chairs' },
  'consumer-product-liability': { src: plateStone, alt: 'Marble pilasters of an institutional facade' },
};

const EASE = [0.16, 1, 0.3, 1];

// The display line is set as two lines wherever the title will break anyway, so
// the break lands on meaning rather than wherever the column edge falls.
const DISPLAY = {
  'civil-litigation': ['Civil', 'Litigation.'],
  'criminal-law': ['Criminal', 'Law.'],
  'constitutional-writ-practice': ['Constitutional', '& writ practice.'],
  'corporate-commercial-law': ['Corporate &', 'commercial law.'],
  'banking-financial-laws': ['Banking &', 'financial laws.'],
  'insolvency-bankruptcy': ['Insolvency', '& bankruptcy.'],
  'taxation-laws': ['Taxation', 'laws.'],
  'labour-employment-law': ['Labour &', 'employment law.'],
  'intellectual-property-rights': ['Intellectual', 'property rights.'],
  'real-estate-infrastructure': ['Real estate', '& infrastructure.'],
  'family-succession-matters': ['Family &', 'succession matters.'],
  'consumer-product-liability': ['Consumer &', 'product liability.'],
};

// PRACTICE — a full-bleed stage rather than a card on the page. The index runs
// down a dark rail on the left; everything else is one photograph with the
// brief set over it. The outgoing display line is held behind the incoming one
// as a ghost, so a change of domain reads as a page turning, not a swap.
export default function Practice() {
  const [active, setActive] = useState(0);
  const p = practiceAreas[active];
  const plate = PLATES[p.slug];
  const display = DISPLAY[p.slug] || [p.title];

  // Counted rather than asserted — if a forum is added to the data, the line
  // beneath the index updates with it instead of quietly going stale.
  const forumCount = useMemo(
    () => new Set(practiceAreas.flatMap(a => a.forums)).size,
    [],
  );

  const select = useCallback(i => () => setActive(i), []);

  // Roving tabindex: only the selected row is in the tab order, so the arrow
  // keys have to carry movement between rows or a keyboard visitor reaches the
  // index and cannot leave the one row it landed on. Moving focus selects,
  // which is what the pointer already does on hover.
  const onKeyDown = useCallback(e => {
    const last = practiceAreas.length - 1;
    let next;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i => (i === last ? 0 : i + 1);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i => (i === 0 ? last : i - 1);
    else if (e.key === 'Home') next = () => 0;
    else if (e.key === 'End') next = () => last;
    else return;

    e.preventDefault();
    setActive(i => {
      const to = next(i);
      // The row owns focus, so it has to be moved by hand once React has
      // re-pointed the tab order at it.
      requestAnimationFrame(() => {
        document.getElementById(`pr-tab-${practiceAreas[to].slug}`)?.focus();
      });
      return to;
    });
  }, []);

  return (
    <section className="practice" id="practice">
      <div className="practice__frame">
        {/* ── index rail ─────────────────────────────────────── */}
        <aside className="practice__rail">
          <span className="practice__rail-eyebrow">Practice Areas</span>

          <div className="practice__rail-list" role="tablist" aria-label="Practice areas" onKeyDown={onKeyDown}>
            {practiceAreas.map((row, i) => (
              <button
                type="button"
                key={row.slug}
                role="tab"
                id={`pr-tab-${row.slug}`}
                aria-selected={i === active}
                aria-controls="pr-stage"
                tabIndex={i === active ? 0 : -1}
                className={`pr-item ${i === active ? 'is-active' : ''}`}
                onMouseEnter={select(i)}
                onFocus={select(i)}
                onClick={select(i)}
              >
                <span className="pr-item__n">{row.n}</span>
                <span className="pr-item__title">{row.title}</span>
                <span className="pr-item__bar" aria-hidden="true" />
              </button>
            ))}
          </div>

          <div className="practice__rail-foot">
            <span className="practice__rail-count">
              <b>12</b> domains <i aria-hidden="true">·</i> <b>{forumCount}</b> forums
            </span>
            <Link to="/practice" className="practice__rail-all">
              <span>All practice areas</span>
              <b aria-hidden="true">→</b>
            </Link>
          </div>
        </aside>

        {/* ── stage ──────────────────────────────────────────── */}
        <div className="practice__stage" id="pr-stage" role="tabpanel" aria-labelledby={`pr-tab-${p.slug}`}>
          <div className="practice__media" aria-hidden="false">
            {/* Both frames stay mounted through the swap, so the outgoing plate
                dissolves into the incoming one — there is never a hole. */}
            <AnimatePresence initial={false}>
              <motion.img
                key={p.slug}
                src={plate.src}
                alt={plate.alt}
                loading="lazy"
                decoding="async"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  transition: { opacity: { duration: 0.9, ease: 'linear' }, scale: { duration: 9, ease: 'linear' } },
                }}
                exit={{ opacity: 0, transition: { duration: 0.9, ease: 'linear' } }}
              />
            </AnimatePresence>
            <span className="practice__media-scrim" aria-hidden="true" />
            <span className="practice__media-grain" aria-hidden="true" />
          </div>

          <Reveal className="practice__body" amount={0.15} y={20}>
            <AnimatePresence mode="wait">
              <motion.div
                key={p.slug}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <span className="practice__badge">
                  <i aria-hidden="true" />
                  Practice {p.n} — {p.tags.length} services
                </span>

                {/* The ghost is the same words held behind the live line,
                    offset and nearly out — the residue of the page that was
                    just turned. It carries aria-hidden so the display line is
                    not announced twice. */}
                <div className="practice__display-wrap">
                  <span className="practice__ghost" aria-hidden="true">
                    {display.map((line, i) => <span key={i}>{line}</span>)}
                  </span>
                  <h2 className="practice__display">
                    {display.map((line, i) => <span key={i}>{line}</span>)}
                  </h2>
                </div>

                <p className="practice__lede">{p.matter}</p>

                <div className="practice__stat">
                  <b>{p.forums.length}</b>
                  <span className="practice__stat-label">Forums engaged</span>
                  <ul className="practice__stat-list">
                    {p.forums.map(f => <li key={f}>{f}</li>)}
                  </ul>
                </div>

                <div className="practice__act">
                  <Link to={`/practice/${p.slug}`} className="practice__cta">
                    <span>Open the full brief</span>
                    <b aria-hidden="true">→</b>
                  </Link>
                  <div className="practice__tags">
                    {p.tags.slice(0, 3).map(t => <span key={t}>{t}</span>)}
                    {p.tags.length > 3 && <span className="practice__tags-more">+{p.tags.length - 3}</span>}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </Reveal>
        </div>
      </div>

      {/* The four working rules the twelve domains have in common — the reason
          the index above is a practice and not a menu. */}
      <div className="practice__principles">
        {principles.map((pr, i) => (
          <Reveal as="div" className="practice__principle" key={pr.n} delay={i * 0.07} amount={0.1}>
            <span className="practice__principle-n">{pr.n}</span>
            <h3 className="practice__principle-title">{pr.title}</h3>
            <p className="practice__principle-body">{pr.body}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
