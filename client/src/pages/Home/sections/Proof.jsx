import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SplitText from '../../../components/ui/SplitText.jsx';

import recordCases from '../../../assets/img/record-cases.webp';
import recordYears from '../../../assets/img/record-years.webp';
import recordSuccess from '../../../assets/img/record-success.webp';
import recordExperience from '../../../assets/img/record-experience.webp';

const EASE = [0.16, 1, 0.3, 1];

export default function Proof() {
  const [activeNode, setActiveNode] = useState(null);

  return (
    <section className="proof-radial-mindmap" id="proof">
      {/* Rich Ambient Backdrop Light Mesh & Grid */}
      <div className="proof-radial-mindmap__mesh" aria-hidden="true" />
      <div className="proof-radial-mindmap__grid-pattern" aria-hidden="true" />

      <div className="container">
        {/* Section Header Label */}
        <header className="proof-radial-mindmap__head">
          <div className="proof-radial-mindmap__badge">
            <span className="proof-radial-mindmap__dot" />
            <span>RECORD OF ADVOCACY · EXECUTIVE MIND MAP</span>
          </div>
        </header>

        {/* ── True 2D Radial Mind Map Stage ── */}
        <div className="radial-stage">
          {/* SVG Connecting Hairline Network */}
          <svg className="radial-svg-network" aria-hidden="true" viewBox="0 0 1000 650" preserveAspectRatio="none">
            {/* Center (500, 325) to Top-Left (240, 160) */}
            <path
              d="M 500 325 C 370 280, 310 200, 240 160"
              className={`radial-line ${activeNode === 'banking' ? 'is-active' : ''}`}
            />
            {/* Center (500, 325) to Top-Right (760, 160) */}
            <path
              d="M 500 325 C 630 280, 690 200, 760 160"
              className={`radial-line ${activeNode === 'disputes' ? 'is-active' : ''}`}
            />
            {/* Center (500, 325) to Bottom-Left (240, 490) */}
            <path
              d="M 500 325 C 370 370, 310 450, 240 490"
              className={`radial-line ${activeNode === 'writs' ? 'is-active' : ''}`}
            />
            {/* Center (500, 325) to Bottom-Right (760, 490) */}
            <path
              d="M 500 325 C 630 370, 690 450, 760 490"
              className={`radial-line ${activeNode === 'defense' ? 'is-active' : ''}`}
            />
          </svg>

          {/* ── 3-Column Radial Layout Matrix ── */}
          <div className="radial-matrix">

            {/* ── LEFT COLUMN (2 Related Nodes) ── */}
            <div className="radial-col radial-col--left">
              {/* Top-Left Node */}
              <motion.div
                className={`radial-node ${activeNode === 'banking' ? 'is-active' : ''}`}
                initial={{ opacity: 0, x: -50, y: -30 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.7, ease: EASE }}
                onMouseEnter={() => setActiveNode('banking')}
                onMouseLeave={() => setActiveNode(null)}
              >
                <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.35, ease: EASE }}>
                  <Link to="/landmark-cases" className="radial-node__link">
                    {/* Rich Content Header (Content Above Image) */}
                    <div className="radial-node__head">
                      <div className="radial-node__top-bar">
                        <span className="radial-node__tag">INSTITUTIONAL ADVISORY</span>
                      </div>
                      <h3 className="radial-node__title">Banking &amp; Financial Recovery</h3>
                      <p className="radial-node__brief">
                        Strategic asset recovery, debt restructuring, and commercial enforcement before Debt Recovery Tribunals.
                      </p>
                    </div>

                    {/* Rich Photo Preview Below Content */}
                    <div className="radial-node__photo">
                      <img src={recordCases} alt="Banking & Financial Recovery" loading="lazy" />
                      <div className="radial-node__scrim" />
                    </div>

                    <div className="radial-node__foot">
                      <span className="radial-node__cta">
                        <span>Examine Case Record</span>
                        <span className="radial-node__arrow">→</span>
                      </span>
                    </div>

                    <div className="radial-node__glow" />
                  </Link>
                </motion.div>
              </motion.div>

              {/* Bottom-Left Node */}
              <motion.div
                className={`radial-node ${activeNode === 'writs' ? 'is-active' : ''}`}
                initial={{ opacity: 0, x: -50, y: 30 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.7, delay: 0.15, ease: EASE }}
                onMouseEnter={() => setActiveNode('writs')}
                onMouseLeave={() => setActiveNode(null)}
              >
                <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.35, ease: EASE }}>
                  <Link to="/landmark-cases" className="radial-node__link">
                    {/* Rich Content Header (Content Above Image) */}
                    <div className="radial-node__head">
                      <div className="radial-node__top-bar">
                        <span className="radial-node__tag">APPELLATE FORUM</span>
                      </div>
                      <h3 className="radial-node__title">Constitutional Writs &amp; Appeals</h3>
                      <p className="radial-node__brief">
                        High Court writ petitions, statutory enforcement, and constitutional administrative proceedings.
                      </p>
                    </div>

                    {/* Rich Photo Preview Below Content */}
                    <div className="radial-node__photo">
                      <img src={recordSuccess} alt="Constitutional & High Court Writs" loading="lazy" />
                      <div className="radial-node__scrim" />
                    </div>

                    <div className="radial-node__foot">
                      <span className="radial-node__cta">
                        <span>Examine Case Record</span>
                        <span className="radial-node__arrow">→</span>
                      </span>
                    </div>

                    <div className="radial-node__glow" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>

            {/* ── CENTER COLUMN (ROUND CIRCULAR MAIN TOPIC DISC) ── */}
            <div className="radial-col radial-col--center">
              <motion.div
                className="radial-core-circle"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.65, ease: EASE }}
              >
                <div className="radial-core-circle__disc">
                  <div className="radial-core-circle__badge">
                    <span className="radial-core-circle__dot" />
                    <span>ADVOCACY CORE</span>
                  </div>
                  <h2 className="radial-core-circle__title">
                    <SplitText text="Decades of High-Stakes Advocacy" as="span" />
                  </h2>
                  <p className="radial-core-circle__sub">30 Years Continuous Courtroom Standing</p>

                  {/* Concentric Metallic Pulse Rings */}
                  <div className="radial-core-circle__ring radial-core-circle__ring--1" aria-hidden="true" />
                  <div className="radial-core-circle__ring radial-core-circle__ring--2" aria-hidden="true" />
                </div>
              </motion.div>
            </div>

            {/* ── RIGHT COLUMN (2 Related Nodes) ── */}
            <div className="radial-col radial-col--right">
              {/* Top-Right Node */}
              <motion.div
                className={`radial-node ${activeNode === 'disputes' ? 'is-active' : ''}`}
                initial={{ opacity: 0, x: 50, y: -30 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
                onMouseEnter={() => setActiveNode('disputes')}
                onMouseLeave={() => setActiveNode(null)}
              >
                <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.35, ease: EASE }}>
                  <Link to="/landmark-cases" className="radial-node__link">
                    {/* Rich Content Header (Content Above Image) */}
                    <div className="radial-node__head">
                      <div className="radial-node__top-bar">
                        <span className="radial-node__tag">COMMERCIAL PRACTICE</span>
                      </div>
                      <h3 className="radial-node__title">Real Estate &amp; Property</h3>
                      <p className="radial-node__brief">
                        Resolution of complex land titles, commercial property disputes, and corporate estate divisions.
                      </p>
                    </div>

                    {/* Rich Photo Preview Below Content */}
                    <div className="radial-node__photo">
                      <img src={recordYears} alt="Real Estate & Property Litigation" loading="lazy" />
                      <div className="radial-node__scrim" />
                    </div>

                    <div className="radial-node__foot">
                      <span className="radial-node__cta">
                        <span>Examine Case Record</span>
                        <span className="radial-node__arrow">→</span>
                      </span>
                    </div>

                    <div className="radial-node__glow" />
                  </Link>
                </motion.div>
              </motion.div>

              {/* Bottom-Right Node */}
              <motion.div
                className={`radial-node ${activeNode === 'defense' ? 'is-active' : ''}`}
                initial={{ opacity: 0, x: 50, y: 30 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: false, amount: 0.2 }}
                transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
                onMouseEnter={() => setActiveNode('defense')}
                onMouseLeave={() => setActiveNode(null)}
              >
                <motion.div whileHover={{ y: -8, scale: 1.02 }} transition={{ duration: 0.35, ease: EASE }}>
                  <Link to="/landmark-cases" className="radial-node__link">
                    {/* Rich Content Header (Content Above Image) */}
                    <div className="radial-node__head">
                      <div className="radial-node__top-bar">
                        <span className="radial-node__tag">TRIAL DEFENSE</span>
                      </div>
                      <h3 className="radial-node__title">Trial Defense &amp; Relief</h3>
                      <p className="radial-node__brief">
                        Specialized trial defense, emergency injunctions, and comprehensive commercial protection.
                      </p>
                    </div>

                    {/* Rich Photo Preview Below Content */}
                    <div className="radial-node__photo">
                      <img src={recordExperience} alt="Trial Defense & Emergency Relief" loading="lazy" />
                      <div className="radial-node__scrim" />
                    </div>

                    <div className="radial-node__foot">
                      <span className="radial-node__cta">
                        <span>Examine Case Record</span>
                        <span className="radial-node__arrow">→</span>
                      </span>
                    </div>

                    <div className="radial-node__glow" />
                  </Link>
                </motion.div>
              </motion.div>
            </div>

          </div>
        </div>

        {/* ── Section Footer Route ── */}
        <motion.footer
          className="proof-radial-mindmap__foot"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="proof-radial-mindmap__foot-info">
            <span className="proof-radial-mindmap__foot-label">ADVOCACY STANDING</span>
            <span className="proof-radial-mindmap__foot-note">
              Established in 1996 · Continuous trial and appellate representation across High Courts and specialized tribunals.
            </span>
          </div>
          <motion.div whileHover={{ x: 4 }}>
            <Link to="/landmark-cases" className="proof-radial-mindmap__foot-link">
              <span>Examine Complete Case Directory</span>
              <span className="proof-radial-mindmap__foot-arrow">→</span>
            </Link>
          </motion.div>
        </motion.footer>
      </div>
    </section>
  );
}
