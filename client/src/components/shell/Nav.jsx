import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { consult } from '../../data/consult.js';
import SlaLogo from '../ui/SlaLogo.jsx';


const LINKS = [
  { to: '/about', label: 'About' },
  { to: '/practice', label: 'Practice Areas' },
  { to: '/team', label: 'Team' },
  { to: '/awards', label: 'Awards' },
  { to: '/landmark-cases', label: 'Landmark Cases' },
  { to: '/contact', label: 'Contact' },
];

export default function Nav({ theme = 'dark' }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 60); }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  const barTheme = scrolled ? 'dark' : theme;

  return (
    <>
      <header className={`nav-bar ${scrolled ? 'is-scrolled' : ''} ${barTheme === 'light' ? 'is-light' : ''}`}>
        <div className="nav-bar__inner">
          <Link to="/" className="brand" aria-label="SLA Advocates Home">
            <SlaLogo size="md" variant={barTheme === 'light' ? 'light' : 'gold'} />
          </Link>



          <nav className="nav-links">
            {LINKS.map(l => (
              <Link key={l.to} to={l.to} className={pathname === l.to ? 'is-active' : ''}>
                <span>{l.label}</span>
              </Link>
            ))}
          </nav>

          <div className="nav-actions">
            <a href={`tel:${consult.phoneHref}`} className="nav-phone">{consult.phone}</a>
            <Link to="/contact" className="btn btn--ghost-invert magnetic"><span>Book Consultation</span></Link>
          </div>

          <button className={`menu-toggle ${open ? 'is-open' : ''}`} aria-label="Toggle menu" onClick={() => setOpen(o => !o)}>
            <span></span><span></span>
          </button>
        </div>
      </header>

      <div className={`mobile-menu ${open ? 'is-open' : ''}`}>
        <nav>
          {LINKS.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </nav>
        <a href={`tel:${consult.phoneHref}`} className="mobile-menu__phone">{consult.phone}</a>
      </div>
    </>
  );
}
