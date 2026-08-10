import { Link } from 'react-router-dom';
import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { team } from '../../../data/team.js';

export default function Team() {
  const featured = team.filter(t => t.featured);
  return (
    <section className="team-preview" id="team">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow"><SplitText text="Meet Our Team" /></span>
          <h2 className="h2">
            <SplitText text="Eleven advocates." as="div" />
            <SplitText text="Seventy-five years, combined." as="div" />
          </h2>
        </div>

        <div className="team-preview__grid">
          {featured.map((a, i) => (
            <Reveal as="div" className="card-adv" key={a.slug} data-initials={a.initials} delay={i * 0.1}>
              <div className="card-adv__exp">{a.exp}</div>
              <div className="card-adv__name" style={{ fontSize: '2rem' }}>{a.name}</div>
              <div className="card-adv__role">{a.role}</div>
              <p className="card-adv__bio">{a.bio}</p>
              <div className="card-adv__meta"><span>{a.qualification}</span><span>{a.cases}</span></div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          <Link to="/team" className="link-arrow"><span>Meet the full team</span> →</Link>
        </Reveal>
      </div>
    </section>
  );
}
