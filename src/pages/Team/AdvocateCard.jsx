import { useState, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export default function AdvocateCard({ advocate, large = false, delay = 0, index = 0 }) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const innerRef = useRef(null);
  const a = advocate;

  useLayoutEffect(() => {
    if (!innerRef.current) return;
    setHeight(open ? innerRef.current.scrollHeight : 0);
  }, [open]);

  return (
    <motion.div
      className={`adv-card ${large ? 'adv-card--lg' : ''} ${open ? 'is-open' : ''}`}
      id={a.slug}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: EASE }}
    >
      <div className="adv-card__photo">
        <span className="adv-card__index">{String(index + 1).padStart(2, '0')}</span>
        <div className="adv-card__photo-inner">
          <span className="adv-card__initials">{a.initials}</span>
          <div className="adv-card__photo-glow" />
          <div className="adv-card__photo-grain" />
          <div className="adv-card__photo-vignette" />
          <div className="adv-card__photo-outline" />
          <motion.div
            className="adv-card__curtain"
            initial={{ scaleY: 1 }}
            whileInView={{ scaleY: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.9, delay: delay + 0.1, ease: EASE }}
          />
        </div>
        <span className="adv-card__exp-badge">{a.exp}</span>
      </div>

      <div className="adv-card__body">
        <h3 className="adv-card__name">{a.name}</h3>
        <p className="adv-card__role">{a.role}</p>
        <p className="adv-card__brief">{a.bio}</p>

        <button
          type="button"
          className={`adv-card__toggle ${open ? 'is-open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls={`${a.slug}-details`}
          aria-label={open ? `Hide full profile for ${a.name}` : `Show full profile for ${a.name}`}
        >
          <span className="adv-card__toggle-line" />
          <span className="adv-card__toggle-line adv-card__toggle-line--v" />
        </button>
      </div>

      <div
        id={`${a.slug}-details`}
        className={`adv-card__details ${open ? 'is-open' : ''}`}
        style={{ height }}
      >
        <div className="adv-card__details-inner" ref={innerRef}>
          <p className="adv-card__long-bio">{a.longBio}</p>
          <div className="adv-card__meta-grid">
            <div><span>Qualification</span>{a.qualification}</div>
            <div><span>Enrollment</span>{a.enrollment}</div>
            <div><span>Experience</span>{a.exp}</div>
            <div><span>Case Record</span>{a.cases}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
