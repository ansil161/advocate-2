import { useState } from 'react';
import Layout from '../../components/shell/Layout.jsx';
import Reveal from '../../components/ui/Reveal.jsx';
import SplitText from '../../components/ui/SplitText.jsx';
import { consult } from '../../data/consult.js';
import { process } from '../../data/firm.js';
import bgImg from '../../assets/img/colonnade-diagonal.webp';
import './Contact.css';

const MATTER_TYPES = ['Civil Litigation', 'Criminal Law', 'Banking & Recovery', 'Real Estate', 'Family & Succession', 'Corporate & Commercial', 'Other'];

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', matter: MATTER_TYPES[0], message: '' });

  function update(field, value) { setForm(f => ({ ...f, [field]: value })); }

  function handleSubmit(e) {
    e.preventDefault();
    const subject = encodeURIComponent(`Consultation request — ${form.matter}`);
    const body = encodeURIComponent(
      `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\nMatter type: ${form.matter}\n\n${form.message}`
    );
    window.location.href = `mailto:${consult.email}?subject=${subject}&body=${body}`;
  }

  return (
    <Layout navTheme="dark">
      <section className="c-hero" id="c-hero">
        <div className="c-hero__bg" aria-hidden="true"><img src={bgImg} alt="" /></div>
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
              Tentative consultation slots — {consult.price} for a focused {consult.duration}.
              Four online slots daily (two morning, two evening) and three in-person
              slots at our office.
            </Reveal>
          </div>

          <Reveal as="form" className="c-form" onSubmit={handleSubmit}>
            <div className="c-form__row">
              <label>
                <span>Name</span>
                <input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" />
              </label>
              <label>
                <span>Phone</span>
                <input required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91" />
              </label>
            </div>
            <label>
              <span>Email</span>
              <input required type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@email.com" />
            </label>
            <label>
              <span>Matter Type</span>
              <select value={form.matter} onChange={e => update('matter', e.target.value)}>
                {MATTER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              <span>Brief Description</span>
              <textarea rows="4" value={form.message} onChange={e => update('message', e.target.value)} placeholder="Tell us briefly about your matter…" />
            </label>
            <button type="submit" className="btn btn--solid magnetic" style={{ width: '100%' }}>
              <span>Send via Email</span>
            </button>
          </Reveal>
        </div>
      </section>

      <section className="c-process" id="c-process">
        <div className="container">
          <span className="eyebrow eyebrow--light"><SplitText text="What Happens Next" /></span>
          <div className="c-process__grid">
            {process.map((p, i) => (
              <Reveal as="div" className="c-process__item" key={p.n} delay={i * 0.08}>
                <span>{p.n}</span>
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
