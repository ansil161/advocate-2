import { Link } from 'react-router-dom';
import SplitText from '../ui/SplitText.jsx';
import SlaLogo from '../ui/SlaLogo.jsx';
import { consult } from '../../data/consult.js';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__giant">
          <SplitText text="Let's talk." stagger={0.06} />
        </div>
      </div>

      <div className="container site-footer__top">
        <div className="site-footer__brand">
          <div style={{ marginBottom: '1.25rem' }}>
            <SlaLogo size="lg" />
          </div>
          <p>SLA Advocates — a Hyderabad-based full-service litigation and advisory firm, personally supervised by Senior Advocate Sridhar Lendalay.</p>
        </div>


        <div className="site-footer__col">
          <h4>Practice Areas</h4>
          <Link to="/practice">Civil Litigation</Link>
          <Link to="/practice">Criminal Law</Link>
          <Link to="/practice">Banking &amp; Recovery</Link>
          <Link to="/practice">Real Estate</Link>
          <Link to="/practice">Family &amp; Succession</Link>
        </div>

        <div className="site-footer__col">
          <h4>Firm</h4>
          <Link to="/about">About Us</Link>
          <Link to="/team">Our Team</Link>
          <Link to="/awards">Recognition</Link>
          <Link to="/landmark-cases">Landmark Cases</Link>
        </div>

        <div className="site-footer__col">
          <h4>Contact</h4>
          <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>
          <a href={`mailto:${consult.email}`}>{consult.email}</a>
          <a href={consult.instagramHref} target="_blank" rel="noopener">{consult.instagram}</a>
          <span className="site-footer__addr">{consult.city}</span>
        </div>
      </div>

      <div className="container site-footer__bottom">
        <span>© {year} SLA Advocates. All rights reserved.</span>
        <span className="site-footer__note">Advocates enrolled with the Bar Council of Telangana. This website is for informational purposes and does not constitute legal advice or advertisement under the Bar Council of India Rules.</span>
      </div>
    </footer>
  );
}
