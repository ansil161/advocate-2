import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
import Icon, { PROCESS_ICONS } from '../../components/ui/Icon.jsx';
import ContactForm from '../../components/ui/ContactForm.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import { consult } from '../../data/consult.js';
import { process } from '../../data/firm.js';
import bgImg from '../../assets/img/colonnade-diagonal.webp';
import bgImg760 from '../../assets/img/colonnade-diagonal-760.webp';
import './Contact.css';

export default function Contact() {
  return (
    <Layout navTheme="dark">
      <PageMeta
        title="Contact"
        description="Speak to SLA Advocates before you file. Four online consultation slots daily and three in-person slots at the firm's Hyderabad office."
        path="/contact"
      />
      <section className="c-hero" id="c-hero">
        {/* Full-bleed decorative layer; the original stays the widest candidate. */}
        <div className="c-hero__bg" aria-hidden="true">
          <img
            src={bgImg}
            srcSet={`${bgImg760} 760w, ${bgImg} 1600w`}
            sizes="100vw"
            alt=""
          />
        </div>
        <div className="container c-hero__content">
          <span className="chapter-label chapter-label--light"><b>Contact</b></span>
          <h1 className="h1 h2--light">
            <SplitText text="Speak to the firm" as="div" />
            <SplitText text="before you file." as="div" />
          </h1>
        </div>
      </section>

      <section className="c-reach" id="c-reach">
        <div className="container c-reach__grid">
          <div className="c-reach__info">
            <span className="eyebrow"><SplitText text="Reach Us" /></span>
            <h2 className="h2"><SplitText text="Hyderabad, Telangana." /></h2>
            <Reveal as="div" className="c-reach__list">
              <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>
              <a href={`mailto:${consult.email}`}>{consult.email}</a>
              <a href={consult.instagramHref} target="_blank" rel="noopener">{consult.instagram}</a>
            </Reveal>
            <Reveal as="p" className="c-reach__note" delay={0.1}>
              Four online consultation slots daily (two morning, two evening) and
              three in-person slots at our office.
            </Reveal>
          </div>

          <Reveal className="c-form-wrap">
            <ContactForm variant="light" />
          </Reveal>
        </div>
      </section>

      <section className="c-process" id="c-process">
        <div className="container">
          <span className="eyebrow eyebrow--light"><SplitText text="What Happens Next" /></span>
          <div className="c-process__grid">
            {process.map((p, i) => (
              <Reveal as="div" className="c-process__item" key={p.title} delay={i * 0.08}>
                <Icon name={PROCESS_ICONS[i]} />
                <h4>{p.title}</h4>
                <p>{p.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
