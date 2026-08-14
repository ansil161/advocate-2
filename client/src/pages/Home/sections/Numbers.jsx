import Reveal from '../../../components/ui/Reveal.jsx';
import Counter from '../../../components/ui/Counter.jsx';
import { stats } from '../../../data/firm.js';

export default function Numbers() {
  return (
    <section className="stats" id="numbers">
      <div className="container stats__grid">
        {stats.map((s, i) => (
          <Reveal as="div" className="stat" key={s.label} delay={i * 0.08}>
            <div className="stat__value"><Counter value={s.value} suffix={s.suffix} /></div>
            <div className="stat__label">{s.label}</div>
            <div className="stat__sub">{s.sub}</div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
