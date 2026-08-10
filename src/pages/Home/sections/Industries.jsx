import { industries } from '../../../data/industries.js';

export default function Industries() {
  const row = industries.map(i => <span key={i.slug}>{i.name}</span>);
  return (
    <section className="industries-band" id="industries">
      <p className="industries-band__label">Industries We Serve</p>
      <div className="marquee">
        <div className="marquee__track">{row}</div>
        <div className="marquee__track" aria-hidden="true">{row}</div>
      </div>
    </section>
  );
}
