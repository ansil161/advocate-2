import { useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { photoFor, cutoutFor } from './lib/teamPhotos.js';

const EASE = [0.16, 1, 0.3, 1];

export default function AdvocateCard({
  advocate,
  isHero = false,
  delay = 0,
  open,
  onToggle,
}) {
  const [height, setHeight] = useState(0);
  const innerRef = useRef(null);
  const a = advocate;
  const photo = cutoutFor(a.slug) || a.photo || photoFor(a.slug);

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    setHeight(open ? innerRef.current.scrollHeight : 0);
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggle?.(a);
    }
  };

  return (
    <motion.article
      className={`counsel-plate ${isHero ? 'counsel-plate--hero' : 'counsel-plate--grid'} ${open ? 'is-open' : ''}`}
      id={a.slug}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {/* THE DETAILS BOX CONTAINER — FULL CARD IS CLICKABLE TO OPEN MODAL */}
      <div
        className="counsel-plate__box"
        onClick={() => onToggle?.(a)}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`Open full profile pop-up for ${a.name}`}
      >

        {/* DETAILS ON THE LEFT */}
        <div className="counsel-plate__details">
          <span className="counsel-plate__exp">{a.exp}</span>
          <h3 className="counsel-plate__name">{a.name}</h3>
          <p className="counsel-plate__role">{a.role}</p>

          <p className="counsel-plate__bio">{a.bio}</p>

          {/* RECOMMENDATION 3: GLASSMORPHIC CREDENTIAL MICRO-PILLS */}
          <div className="counsel-plate__pills-row">
            {a.qualification && (
              <div className="counsel-plate__pill" title={`Qualification: ${a.qualification}`}>
                <span className="pill-label">Qual</span>
                <span className="pill-val">{a.qualification}</span>
              </div>
            )}
            {a.cases && (
              <div className="counsel-plate__pill" title={`Cases: ${a.cases}`}>
                <span className="pill-label">Cases</span>
                <span className="pill-val">{a.cases}</span>
              </div>
            )}
          </div>

          <div className="counsel-plate__toggle-btn">
            <span>{open ? 'Hide Profile' : 'View Profile'}</span>
            <span className="counsel-plate__arrow" aria-hidden="true">→</span>
          </div>
        </div>

        {/* CUTOUT PORTRAIT ON THE RIGHT EXTENDING ABOVE THE BOX */}
        <div className="counsel-plate__portrait">
          {photo ? (
            <img src={photo} alt={a.name} loading="lazy" />
          ) : (
            <span className="counsel-plate__initials">{a.initials}</span>
          )}
        </div>
      </div>

      {/* EXPANDABLE PROFILE DRAWER */}
      <div
        id={`${a.slug}-details`}
        className={`counsel-plate__drawer ${open ? 'is-open' : ''}`}
        style={{ height }}
      >
        <div className="counsel-plate__drawer-inner" ref={innerRef}>
          <div className="counsel-plate__divider" />
          <p className="counsel-plate__long-bio">{a.longBio}</p>
          <div className="counsel-plate__specs">
            <div>
              <span className="lbl">Experience</span>
              <span className="val">{a.exp}</span>
            </div>
            <div>
              <span className="lbl">Track Record</span>
              <span className="val">{a.cases}</span>
            </div>
            <div>
              <span className="lbl">Bar Enrollment</span>
              <span className="val">{a.enrollment || '—'}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
