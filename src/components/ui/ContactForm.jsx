import { useState } from 'react';
import { consult } from '../../data/consult.js';
import './ContactForm.css';

export const MATTER_TYPES = [
  'Civil Litigation',
  'Criminal Law',
  'Banking & Recovery',
  'Real Estate',
  'Family & Succession',
  'Corporate & Commercial',
  'Other',
];

// The firm's single consultation form. Rendered inside every page's CTA band
// (variant="dark") and on the Contact page itself (variant="light") so a matter
// can be opened from wherever the visitor happens to stop reading.
export default function ContactForm({
  variant = 'light',
  heading,
  note,
  submitLabel = 'Send via Email',
  defaultMatter,
  className = '',
}) {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    matter: MATTER_TYPES.includes(defaultMatter) ? defaultMatter : MATTER_TYPES[0],
    message: '',
  });

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
    <form className={`cform cform--${variant} ${className}`.trim()} onSubmit={handleSubmit}>
      {(heading || note) && (
        <div className="cform__head">
          {heading && <span className="cform__heading">{heading}</span>}
          {note && <p className="cform__note">{note}</p>}
        </div>
      )}

      <div className="cform__fields">
        <div className="cform__row">
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
        <button type="submit" className="btn btn--solid magnetic cform__submit">
          <span>{submitLabel}</span>
        </button>
      </div>

      <p className="cform__alt">
        Prefer to talk first? <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>
      </p>
    </form>
  );
}
