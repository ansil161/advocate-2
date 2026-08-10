import SplitText from '../ui/SplitText.jsx';
import Reveal from '../ui/Reveal.jsx';
import { consult } from '../../data/consult.js';
import bgImg from '../../assets/img/columns-abstract.webp';

export default function Consult({ id = 'consult' }) {
  return (
    <section className="consult" id={id}>
      <div className="consult__bg" aria-hidden="true"><img src={bgImg} alt="" /></div>
      <span className="consult__mark" aria-hidden="true">SL</span>

      <div className="container consult__inner">
        <div className="consult__grid">
          <div className="consult__lead">
            <span className="eyebrow eyebrow--light"><SplitText text="Book a Consultation" /></span>
            <h2 className="h2 h2--light consult__title">
              <SplitText text="Speak to the firm" as="div" />
              <SplitText text="before you file." as="div" />
            </h2>
            <Reveal as="p" className="consult__assurance">
              Every matter — from first consultation to final execution — carries
              Sridhar Lendalay’s personal oversight. Not a junior associate. Not a call centre.
            </Reveal>
            <Reveal className="consult__sign" delay={0.1}>
              <span className="consult__sign-name">Sridhar Lendalay</span>
              <span className="consult__sign-role">Founder &amp; Senior Advocate</span>
            </Reveal>
          </div>

          <Reveal className="consult__card" delay={0.15} y={20}>
            <div className="consult__card-heading">
              <span>Get in Touch</span>
              <p>Speak directly with the firm about your matter.</p>
            </div>
            <div className="consult__card-actions">
              <a href={`tel:${consult.phoneHref}`} className="btn btn--solid magnetic"><span>Call {consult.phone}</span></a>
              <a href={`mailto:${consult.email}`} className="btn btn--line-invert magnetic"><span>Email the Firm</span></a>
            </div>
            <div className="consult__card-meta">
              <div><span>Online</span>2 Morning · 2 Evening</div>
              <div><span>In-Person</span>{consult.offlineSlots} Slots · Hyderabad Office</div>
              <div><span>Instagram</span>{consult.instagram}</div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
