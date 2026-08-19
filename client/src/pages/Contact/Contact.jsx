import Layout from '../../components/shell/Layout.jsx';
import PageMeta from '../../components/shell/PageMeta.jsx';
import Icon, { PROCESS_ICONS } from '../../components/ui/Icon.jsx';
import ContactForm from '../../components/ui/ContactForm.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import { consult } from '../../data/consult.js';
import { process } from '../../data/firm.js';
import heroImg from '../../assets/img/contact-hero.jpg';
import './Contact.css';

export default function Contact() {
  return (
    <Layout navTheme="dark">
      <PageMeta
        title="Contact"
        description="Speak to SLA Advocates before you file. Four online consultation slots daily and three in-person slots at the firm's Hyderabad office."
        path="/contact"
      />
      
      {/* 1. Cinematic Hero */}
      <section className="c-hero" id="c-hero">
        <div className="c-hero__bg" aria-hidden="true">
          <img
            src={heroImg}
            alt="Law firm office interior"
          />
          <div className="c-hero__overlay" />
        </div>
        <div className="container c-hero__content">
          <span className="chapter-label chapter-label--light"><b>Contact</b></span>
          <h1 className="h1 h2--light">
            <SplitText text="Speak to the firm" as="div" />
            <SplitText text="before you file." as="div" />
          </h1>
        </div>
      </section>

      {/* 2. High-Contrast Form & Reach Section */}
      <section className="c-reach" id="c-reach">
        <div className="container c-reach__grid">
          
          <div className="c-reach__info">
            <span className="c-reach__sub">Direct Access</span>
            <h2 className="c-reach__title">Hyderabad, Telangana.</h2>
            <Reveal as="div" className="c-reach__list">
              <div className="c-reach__link-group">
                <span className="c-reach__link-label">Phone</span>
                <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>
              </div>
              <div className="c-reach__link-group">
                <span className="c-reach__link-label">Email</span>
                <a href={`mailto:${consult.email}`}>{consult.email}</a>
              </div>
              <div className="c-reach__link-group">
                <span className="c-reach__link-label">Social</span>
                <a href={consult.instagramHref} target="_blank" rel="noopener">{consult.instagram}</a>
              </div>
            </Reveal>
            <Reveal as="p" className="c-reach__note" delay={0.1}>
              Four online consultation slots daily (two morning, two evening) and
              three in-person slots at our office.
            </Reveal>
          </div>

          <Reveal className="c-form-wrap">
            <ContactForm variant="dark" heading="Request a Consultation" note="Tell us briefly about your matter. All details are kept strictly confidential." />
          </Reveal>
          
        </div>
      </section>

      {/* 3. Sleek Editorial Process */}
      <section className="c-process" id="c-process">
        <div className="container">
          <header className="c-process__head">
            <span className="eyebrow"><SplitText text="The Process" /></span>
            <h2 className="h2"><SplitText text="What happens next." /></h2>
          </header>
          
          <div className="c-process__list">
            {process.map((p, i) => (
              <Reveal as="div" className="c-process__item" key={p.title} delay={i * 0.08}>
                <div className="c-process__num">{String(i + 1).padStart(2, '0')}</div>
                <div className="c-process__content">
                  <h4>{p.title}</h4>
                  <p>{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
