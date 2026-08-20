import { useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { photoFor } from './lib/teamPhotos.js';

const EASE = [0.16, 1, 0.3, 1];

export default function AdvocateCard({
  advocate,
  large = false,
  align = 'left',
  delay = 0,
  open,
  onToggle,
}) {
  const [height, setHeight] = useState(0);
  const innerRef = useRef(null);
  const a = advocate;
  const photo = photoFor(a.slug);

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    setHeight(open ? innerRef.current.scrollHeight : 0);
  }, [open]);

  // EDITORIAL HERO CARD FOR FOUNDERS / SENIOR ADVOCATES
  if (large) {
    return (
      <motion.div
        className={`adv-card--executive ${open ? 'is-open' : ''}`}
        id={a.slug}
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, delay, ease: EASE }}
      >
        <div className="adv-card--executive__glow" aria-hidden="true" />

        <div className="adv-card--executive__header-row">
          <div className="adv-card--executive__portrait-wrap">
            <div className="adv-card--executive__portrait-ring">
              {photo ? (
                <img className="adv-card--executive__img" src={photo} alt={a.name} loading="lazy" />
              ) : (
                <span className="adv-card--executive__initials">{a.initials}</span>
              )}
            </div>
            <span className="adv-card__badge-exp">{a.exp}</span>
          </div>

          <div className="adv-card--executive__title-block">
            <span className="adv-card__tag">Senior Advocate & Leadership</span>
            <h3 className="adv-card__title">{a.name}</h3>
            <p className="adv-card__subtitle">{a.role}</p>
          </div>
        </div>

        <div className="adv-card--executive__body">
          <p className="adv-card__bio-text">{a.bio}</p>

          <div className="adv-card__stats-row">
            <div className="adv-card__stat-pill">
              <span className="stat-label">Qualification</span>
              <span className="stat-val">{a.qualification}</span>
            </div>
            <div className="adv-card__stat-pill">
              <span className="stat-label">Enrollment</span>
              <span className="stat-val">{a.enrollment}</span>
            </div>
            <div className="adv-card__stat-pill">
              <span className="stat-label">Track Record</span>
              <span className="stat-val">{a.cases}</span>
            </div>
          </div>

          <button
            type="button"
            className={`adv-card__action-btn ${open ? 'is-open' : ''}`}
            onClick={() => onToggle?.(a.slug)}
            aria-expanded={!!open}
            aria-controls={`${a.slug}-details`}
          >
            <span>{open ? 'Collapse Profile' : 'Explore Full Profile'}</span>
            <span className="btn-arrow" aria-hidden="true">→</span>
          </button>

          <div
            id={`${a.slug}-details`}
            className={`adv-card__drawer ${open ? 'is-open' : ''}`}
            style={{ height }}
          >
            <div className="adv-card__drawer-inner" ref={innerRef}>
              <div className="adv-card__divider" />
              <p className="adv-card__extended-bio">{a.longBio}</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }


  // MODERN GRID CARD FOR ADVOCATES
  return (
    <motion.div
      className={`adv-card--modern ${open ? 'is-open' : ''}`}
      id={a.slug}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      <div className="adv-card--modern__media">
        <div className="adv-card--modern__frame">
          {photo ? (
            <img className="adv-card--modern__img" src={photo} alt={a.name} loading="lazy" />
          ) : (
            <span className="adv-card--modern__initials">{a.initials}</span>
          )}
          <div className="adv-card--modern__scrim" />
        </div>
        <span className="adv-card__badge-exp">{a.exp}</span>
      </div>

      <div className="adv-card--modern__body">
        <div className="adv-card--modern__head">
          <h3 className="adv-card__title">{a.name}</h3>
          <p className="adv-card__subtitle">{a.role}</p>
        </div>
        <p className="adv-card__bio-text">{a.bio}</p>

        <button
          type="button"
          className={`adv-card__action-btn adv-card__action-btn--sm ${open ? 'is-open' : ''}`}
          onClick={() => onToggle?.(a.slug)}
          aria-expanded={!!open}
          aria-controls={`${a.slug}-details`}
        >
          <span>{open ? 'Hide Profile' : 'View Profile'}</span>
          <span className="btn-arrow" aria-hidden="true">→</span>
        </button>
      </div>

      <div
        id={`${a.slug}-details`}
        className={`adv-card__drawer ${open ? 'is-open' : ''}`}
        style={{ height }}
      >
        <div className="adv-card__drawer-inner" ref={innerRef}>
          <div className="adv-card__divider" />
          <p className="adv-card__extended-bio">{a.longBio}</p>
          <div className="adv-card__credentials-grid">
            <div className="cred-item">
              <span className="cred-lbl">Qualification</span>
              <span className="cred-val">{a.qualification}</span>
            </div>
            <div className="cred-item">
              <span className="cred-lbl">Enrollment</span>
              <span className="cred-val">{a.enrollment}</span>
            </div>
            <div className="cred-item">
              <span className="cred-lbl">Cases</span>
              <span className="cred-val">{a.cases}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

