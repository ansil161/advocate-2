import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { photoFor, cutoutFor } from './lib/teamPhotos.js';

export default function AdvocateModal({ advocate, onClose }) {
  useEffect(() => {
    if (!advocate) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [advocate, onClose]);

  if (!advocate) return null;

  const a = advocate;
  const photo = cutoutFor(a.slug) || a.photo || photoFor(a.slug);

  return (
    <AnimatePresence>
      <div className="adv-modal-backdrop" onClick={onClose}>
        <motion.div
          className="adv-modal-container"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="adv-modal-name"
        >
          {/* CLOSE BUTTON */}
          <button
            type="button"
            className="adv-modal-close-btn"
            onClick={onClose}
            aria-label="Close Profile Modal"
          >
            ✕
          </button>

          {/* MODAL HERO SECTION WITH CUTOUT FIGURE */}
          <div className="adv-modal-hero">
            <div className="adv-modal-hero-details">
              <span className="adv-modal-badge">{a.exp}</span>
              <h2 id="adv-modal-name" className="adv-modal-title">{a.name}</h2>
              <p className="adv-modal-role">{a.role}</p>

              <div className="adv-modal-tags">
                {a.qualification && (
                  <span className="adv-modal-tag">
                    <strong>Qual:</strong> {a.qualification}
                  </span>
                )}
                {a.enrollment && a.enrollment !== '—' && (
                  <span className="adv-modal-tag">
                    <strong>Enrol:</strong> {a.enrollment}
                  </span>
                )}
              </div>
            </div>

            <div className="adv-modal-hero-cutout">
              {photo ? (
                <img src={photo} alt={a.name} loading="lazy" />
              ) : (
                <span className="adv-modal-initials">{a.initials}</span>
              )}
            </div>
          </div>

          {/* MODAL BODY CONTENT */}
          <div className="adv-modal-body">
            <div className="adv-modal-section">
              <h3 className="adv-modal-sec-title">Professional Overview</h3>
              <p className="adv-modal-bio-lead">{a.bio}</p>
              {a.longBio && <p className="adv-modal-bio-extended">{a.longBio}</p>}
            </div>

            <div className="adv-modal-stats-grid">
              <div className="adv-modal-stat-box">
                <span className="stat-label">Court Experience</span>
                <span className="stat-val">{a.exp}</span>
              </div>
              <div className="adv-modal-stat-box">
                <span className="stat-label">Track Record</span>
                <span className="stat-val">{a.cases}</span>
              </div>
              <div className="adv-modal-stat-box">
                <span className="stat-label">Bar License</span>
                <span className="stat-val">{a.enrollment || 'Registered Advocate'}</span>
              </div>
            </div>

            {/* MODAL FOOTER ACTIONS */}
            <div className="adv-modal-footer">
              <Link
                to="/contact"
                className="adv-modal-primary-btn"
                onClick={onClose}
              >
                <span>Book Consultation with {a.name.split(' ')[0]}</span>
                <span className="btn-arrow">→</span>
              </Link>
              <button
                type="button"
                className="adv-modal-secondary-btn"
                onClick={onClose}
              >
                Close Profile
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
