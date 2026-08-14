import { useRef, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { photoFor } from './lib/teamPhotos.js';

const EASE = [0.16, 1, 0.3, 1];

export default function AdvocateCard({
  advocate,
  large = false,
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

  return (
    <motion.div
      className={`adv-card ${large ? 'adv-card--lg' : ''} ${open ? 'is-open' : ''}`}
      id={a.slug}
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.85, delay, ease: EASE }}
    >
      <div className="adv-card__photo">
        <div className="adv-card__photo-inner">
          {photo ? (
            <img className="adv-card__img" src={photo} alt={a.name} loading="lazy" />
          ) : (
            <span className="adv-card__initials">{a.initials}</span>
          )}
          <div className="adv-card__photo-grain" />
          <div className="adv-card__photo-vignette" />
          <div className="adv-card__photo-outline" />
          <motion.div
            className="adv-card__curtain"
            initial={{ scaleY: 1 }}
            whileInView={{ scaleY: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.95, delay: delay + 0.12, ease: EASE }}
          />
        </div>
        <span className="adv-card__exp-badge">{a.exp}</span>
      </div>

      <div className="adv-card__body">
        <h3 className="adv-card__name">{a.name}</h3>
        <p className="adv-card__role">{a.role}</p>
        <p className="adv-card__brief">{a.bio}</p>

        {/* The senior cards run full width, so their credentials sit on the
            face of the card rather than behind the toggle — otherwise the
            right half of the card is just empty. */}
        {large && (
          <dl className="adv-card__creds">
            <div>
              <dt>Qualification</dt>
              <dd>{a.qualification}</dd>
            </div>
            <div>
              <dt>Enrollment</dt>
              <dd>{a.enrollment}</dd>
            </div>
            <div>
              <dt>Case Record</dt>
              <dd>{a.cases}</dd>
            </div>
          </dl>
        )}

        <button
          type="button"
          className={`adv-card__toggle ${open ? 'is-open' : ''}`}
          onClick={() => onToggle?.(a.slug)}
          aria-expanded={!!open}
          aria-controls={`${a.slug}-details`}
        >
          <span className="adv-card__toggle-label">
            {open ? 'Close profile' : 'Full profile'}
          </span>
          <span className="adv-card__toggle-icon" aria-hidden="true">
            <span className="adv-card__toggle-line" />
            <span className="adv-card__toggle-line adv-card__toggle-line--v" />
          </span>
        </button>
      </div>

      <div
        id={`${a.slug}-details`}
        className={`adv-card__details ${open ? 'is-open' : ''}`}
        style={{ height }}
      >
        <div className="adv-card__details-inner" ref={innerRef}>
          <p className="adv-card__long-bio">{a.longBio}</p>
          {/* Large cards already show these on the face — don't repeat them. */}
          {!large && (
            <div className="adv-card__meta-grid">
              <div><span>Qualification</span>{a.qualification}</div>
              <div><span>Enrollment</span>{a.enrollment}</div>
              <div><span>Experience</span>{a.exp}</div>
              <div><span>Case Record</span>{a.cases}</div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
