import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { consult } from '../../data/consult.js';
import { FIELDS, LIMITS, validateEnquiry, validateField } from '../../lib/enquiryValidation.js';
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

const EASE = [0.16, 1, 0.3, 1];

const EMPTY = { name: '', phone: '', email: '', matter: '', message: '' };

const SEND_FAILED =
  'Unable to send your enquiry. Please try again or contact us directly by phone or email.';

// The enquiry is handed to the visitor's own mail client. There is no server in
// front of it, so nothing here can confirm the firm received anything — the only
// failure this can observe is the handoff itself refusing to open. Should a real
// endpoint ever be added, this is the single function that has to change.
function deliverEnquiry(form) {
  const subject = encodeURIComponent(`Consultation request — ${form.matter}`);
  const body = encodeURIComponent(
    `Name: ${form.name}\nPhone: ${form.phone}\nEmail: ${form.email}\nMatter type: ${form.matter}\n\n${form.message}`
  );
  window.location.href = `mailto:${consult.email}?subject=${subject}&body=${body}`;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

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
  const initialMatter = MATTER_TYPES.includes(defaultMatter) ? defaultMatter : MATTER_TYPES[0];
  const [form, setForm] = useState({ ...EMPTY, matter: initialMatter });
  // Only holds errors that are currently on screen — a field stays quiet until
  // the visitor has either filled it in or tried to submit.
  const [errors, setErrors] = useState({});
  // 'idle' | 'sending' | 'sent' | 'failed'
  const [status, setStatus] = useState('idle');

  const uid = useId();
  const inputs = useRef({});
  const doneRef = useRef(null);
  const sending = useRef(false);
  // Skips the first render so opening a page never steals focus into the form.
  const settled = useRef(false);

  // Focus follows the outcome once React has committed it: onto the resolved
  // panel when the enquiry goes out, back to the first field when the visitor
  // asks for a fresh one. preventScroll everywhere — Lenis owns the page
  // position and nothing here should move it.
  useEffect(() => {
    if (status === 'sent') { doneRef.current?.focus({ preventScroll: true }); settled.current = true; }
    else if (status === 'idle' && settled.current) { settled.current = false; inputs.current.name?.focus({ preventScroll: true }); }
  }, [status]);

  const fieldId = field => `${uid}-${field}`;
  const errorId = field => `${uid}-${field}-error`;

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    // Re-check only fields already showing an error, so the message clears as
    // soon as it is fixed without anyone being corrected mid-word.
    setErrors(prev => (prev[field] ? { ...prev, [field]: validateField(field, value) } : prev));
  }

  function handleBlur(field, value) {
    // An untouched, still-empty field is left alone until submit.
    if (!value.trim() && !errors[field]) return;
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (sending.current || status === 'sent') return;

    const found = validateEnquiry(form);
    setErrors(found);

    const firstInvalid = FIELDS.find(field => found[field]);
    if (firstInvalid) {
      setStatus('idle');
      // preventScroll keeps Lenis in charge of the page position — the form is
      // already in view when the submit button was reachable.
      inputs.current[firstInvalid]?.focus({ preventScroll: true });
      return;
    }

    sending.current = true;
    setStatus('sending');
    try {
      const trimmed = Object.fromEntries(FIELDS.map(f => [f, form[f].trim()]));
      deliverEnquiry(trimmed);
      // A short settle before the panel swaps in: it gives the mail client a
      // moment to come forward rather than appearing over a changed page.
      await wait(450);
      setStatus('sent');
    } catch {
      setStatus('failed');
    } finally {
      sending.current = false;
    }
  }

  function reset() {
    setForm({ ...EMPTY, matter: initialMatter });
    setErrors({});
    setStatus('idle');
  }

  const busy = status === 'sending';
  const sent = status === 'sent';

  // Shared wiring for every control: the id the label points at, the ref used
  // to focus the first invalid field, and the aria pair that ties an input to
  // its message.
  function control(field) {
    const invalid = Boolean(errors[field]);
    return {
      id: fieldId(field),
      name: field,
      ref: el => { inputs.current[field] = el; },
      value: form[field],
      onChange: e => update(field, e.target.value),
      onBlur: e => handleBlur(field, e.target.value),
      'aria-invalid': invalid || undefined,
      'aria-describedby': invalid ? errorId(field) : undefined,
    };
  }

  function fieldError(field) {
    if (!errors[field]) return null;
    return <span className="cform__error" id={errorId(field)}>{errors[field]}</span>;
  }

  return (
    <form
      className={`cform cform--${variant} ${className}`.trim()}
      onSubmit={handleSubmit}
      noValidate
    >
      <div className="cform__body" inert={sent}>
        {(heading || note) && (
          <div className="cform__head">
            {heading && <span className="cform__heading">{heading}</span>}
            {note && <p className="cform__note">{note}</p>}
          </div>
        )}

        <div className="cform__fields">
          <div className="cform__row">
            <label htmlFor={fieldId('name')}>
              <span>Name</span>
              <input required autoComplete="name" placeholder="Your full name" {...control('name')} />
              {fieldError('name')}
            </label>
            <label htmlFor={fieldId('phone')}>
              <span>Phone</span>
              <input required type="tel" autoComplete="tel" placeholder="+91" {...control('phone')} />
              {fieldError('phone')}
            </label>
          </div>
          <label htmlFor={fieldId('email')}>
            <span>Email</span>
            <input required type="email" autoComplete="email" placeholder="you@email.com" {...control('email')} />
            {fieldError('email')}
          </label>
          <label htmlFor={fieldId('matter')}>
            <span>Matter Type</span>
            <select {...control('matter')}>
              {MATTER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {fieldError('matter')}
          </label>
          <label htmlFor={fieldId('message')}>
            <span>Brief Description</span>
            <textarea
              required
              rows="4"
              maxLength={LIMITS.messageMax}
              placeholder="Tell us briefly about your matter…"
              {...control('message')}
            />
            {fieldError('message')}
          </label>

          {status === 'failed' && (
            <p className="cform__alert" role="alert">{SEND_FAILED}</p>
          )}

          <button
            type="submit"
            className="btn btn--solid magnetic cform__submit"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            <span>{busy ? 'Sending…' : submitLabel}</span>
          </button>
        </div>

        <p className="cform__alt">
          Prefer to talk first? <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>
        </p>
      </div>

      {/* Live region stays mounted so the status change is announced rather
          than read as a new element appearing. */}
      <p className="cform__live" aria-live="polite">
        {busy ? 'Sending your enquiry.' : ''}
        {sent ? 'Your enquiry is ready to send from your email app.' : ''}
      </p>

      <AnimatePresence>
        {sent && (
          // pointerEvents drops on the way out so the fading panel never sits
          // over a form the visitor has already been sent back to.
          <motion.div
            className="cform__done"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.3 } }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            {/* Focused on arrival so keyboard and screen-reader users land on
                the outcome instead of being left on a button that vanished. */}
            <span className="cform__done-label" ref={doneRef} tabIndex={-1}>Enquiry Prepared</span>
            <span className="cform__heading">One last step</span>
            <p className="cform__done-text">
              Your email app has opened with the enquiry addressed to{' '}
              <a href={`mailto:${consult.email}`}>{consult.email}</a> — press send there and the
              firm will review it and come back to you shortly.
            </p>
            <p className="cform__done-text cform__done-text--fine">
              Nothing opened? Write to us at that address, or call{' '}
              <a href={`tel:${consult.phoneHref}`}>{consult.phone}</a>.
            </p>
            <button type="button" className="cform__again" onClick={reset}>
              Send another enquiry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
