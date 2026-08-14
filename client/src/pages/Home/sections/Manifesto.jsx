import Reveal from '../../../components/ui/Reveal.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import { manifesto } from '../../../data/firm.js';

export default function Manifesto() {
  return (
    <section className="manifesto" id="manifesto">
      <div className="container">
        <span className="eyebrow eyebrow--light"><SplitText text={manifesto.eyebrow} /></span>
        <div className="manifesto__lines">
          {manifesto.lines.map((line, i) => (
            <Reveal as="p" key={i} delay={i * 0.05} className="manifesto__line">
              <SplitText text={line} stagger={0.02} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
