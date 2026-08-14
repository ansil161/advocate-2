import SplitText from '../ui/SplitText.jsx';
import Reveal from '../ui/Reveal.jsx';
import ContactForm from '../ui/ContactForm.jsx';
import { consult } from '../../data/consult.js';
import bgImg from '../../assets/img/columns-abstract.webp';

export default function Consult({ id = 'consult', matter }) {
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
            <Reveal as="div" className="consult__meta" delay={0.15}>
              <div><span>Online</span>2 Morning · 2 Evening</div>
              <div><span>In-Person</span>{consult.offlineSlots} Slots · Hyderabad Office</div>
              <div><span>Instagram</span><a href={consult.instagramHref} target="_blank" rel="noopener">{consult.instagram}</a></div>
            </Reveal>
          </div>

          <Reveal className="consult__card" delay={0.15} y={20}>
            <ContactForm
              variant="dark"
              heading="Get in Touch"
              note="Tell us about your matter — we reply from the firm, not a call centre."
              defaultMatter={matter}
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
