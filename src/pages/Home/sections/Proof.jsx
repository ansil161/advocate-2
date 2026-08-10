import { Link } from 'react-router-dom';
import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { credentials } from '../../../data/awards.js';
import { landmarkCases } from '../../../data/landmarkCases.js';

export default function Proof() {
  const preview = landmarkCases.slice(0, 3);
  return (
    <section className="proof" id="proof">
      <div className="container proof__grid">
        <div className="proof__text">
          <span className="eyebrow"><SplitText text="Proof, Not Promises" /></span>
          <h2 className="h2">
            <SplitText text="Standing built on record," as="div" />
            <SplitText text="not marketing." as="div" />
          </h2>
          <Reveal as="p" className="lede">
            Enrolled with the Bar Council of Telangana, with regular appearances
            before the High Court, City Civil Courts, DRT and NCLT — our credibility
            is measured in outcomes.
          </Reveal>
          <Reveal delay={0.1}>
            <Link to="/awards" className="link-arrow"><span>See recognition &amp; credentials</span> →</Link>
          </Reveal>

          <div className="proof__stats">
            {credentials.slice(0, 2).map((c, i) => (
              <Reveal as="div" className="rec-stat" key={c.label} delay={0.06 * i}>
                <div className="rec-stat__value">{c.value}</div>
                <div className="rec-stat__label">{c.label}</div>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="proof__cases">
          {preview.map((c, i) => (
            <Reveal as="div" className="proof__case" key={c.n} delay={0.08 * i}>
              <span className="proof__case-num">{c.n}</span>
              <div>
                <span className="proof__case-cat">{c.category}</span>
                <h4>{c.title}</h4>
                <p>{c.summary}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.3}>
            <Link to="/landmark-cases" className="link-arrow"><span>View landmark cases</span> →</Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
