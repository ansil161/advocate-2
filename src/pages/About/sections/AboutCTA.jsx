import Icon from '../../../components/ui/Icon.jsx';
import SplitText from '../../../components/ui/SplitText.jsx';
import Reveal from '../../../components/ui/Reveal.jsx';
import ContactForm from '../../../components/ui/ContactForm.jsx';
import { consult } from '../../../data/consult.js';
import bgImg from '../../../assets/img/bookshelf-mono.webp';

export default function AboutCTA() {
  return (
    <section className="a-cta" id="a-cta">
      <div className="a-cta__bg" aria-hidden="true"><img src={bgImg} alt="" /></div>
      <div className="a-cta__grain" aria-hidden="true" />

      <div className="container a-cta__inner">
        <Reveal as="div" className="a-cta__frame" y={24}>
          <span className="a-cta__corner a-cta__corner--tl" aria-hidden="true" />
          <span className="a-cta__corner a-cta__corner--tr" aria-hidden="true" />
          <span className="a-cta__corner a-cta__corner--bl" aria-hidden="true" />
          <span className="a-cta__corner a-cta__corner--br" aria-hidden="true" />

          <span className="chapter-label chapter-label--light"><Icon name="conversation" /> Begin Your Matter</span>
          <h2 className="h2 h2--light a-cta__title">
            <SplitText text="The next chapter is" as="div" />
            <SplitText text="yours to write." as="div" className="a-cta__title--em" />
          </h2>
          <Reveal as="p" className="a-cta__body" delay={0.05}>
            Every matter — from first consultation to final execution — carries
            Sridhar Lendalay’s personal oversight. Not a junior associate. Not a call centre.
          </Reveal>
          <Reveal className="a-cta__sign" delay={0.1}>
            <span className="a-cta__sign-name">Sridhar Lendalay</span>
            <span className="a-cta__sign-role">Founder &amp; Senior Advocate</span>
          </Reveal>
          <Reveal className="a-cta__form" delay={0.15} y={20}>
            <ContactForm
              variant="dark"
              heading="Open Your Matter"
              note="Send the outline — the reply comes from the firm."
              submitLabel="Send to the Firm"
            />
          </Reveal>
          <Reveal as="p" className="a-cta__alt" delay={0.2}>
            Prefer to talk first? <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a> · <a href={`mailto:${consult.email}`}>{consult.email}</a>
          </Reveal>
        </Reveal>
      </div>
    </section>
  );
}
