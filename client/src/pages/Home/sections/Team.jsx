import { Link } from 'react-router-dom';
import CounselCard from '../../../components/ui/CounselCard.jsx';
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

        {/* Both plates keep the figure on the right. Mirroring one of them would
            stand the two men back to back down the centre of the spread. */}
        <div className="team-preview__stack">
          {featured.map((a, i) => (
            <Reveal key={a.slug} delay={i * 0.08} amount={0.15}>
              <Link to={`/team#${a.slug}`} className="team-preview__link">
                <CounselCard advocate={a} />
              </Link>
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
