// Validation rules for the firm's consultation enquiry form. Kept out of the
// component so the messages live in one place and the same rule can run on
// blur, on change and on submit without being restated.

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  // E.164 allows 15 digits at most; 7 is the shortest number worth accepting.
  phoneMin: 7,
  phoneMax: 15,
  emailMax: 254,
  messageMin: 20,
  // The enquiry travels as a mailto: query string — long bodies get truncated
  // or rejected outright by some mail clients, so it is capped here instead.
  messageMax: 1500,
};

const MESSAGES = {
  name: {
    required: 'Please enter your name.',
    short: 'Please enter your full name.',
    long: `Please keep your name under ${LIMITS.nameMax} characters.`,
  },
  phone: {
    required: 'Please enter your phone number.',
    invalid: 'Please enter a valid phone number.',
  },
  email: {
    required: 'Please enter your email address.',
    invalid: 'Please enter a valid email address.',
  },
  matter: { required: 'Please choose the type of matter.' },
  message: {
    required: 'Please tell us briefly about your enquiry.',
    short: `Please add a little more detail — at least ${LIMITS.messageMin} characters.`,
    long: `Please keep the outline under ${LIMITS.messageMax} characters.`,
  },
};

// Deliberately permissive: one @, a dot-bearing domain, no spaces. Anything
// stricter starts rejecting addresses that genuinely exist.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
// A name has to contain at least one letter — "12", "..." and "----" do not.
const NAME_RE = /\p{L}/u;
// Spaces, dots, dashes, brackets and a single leading + are all normal ways to
// write a number; only the digit count is actually checked.
const PHONE_ALLOWED_RE = /^\+?[\d\s().-]+$/;

export const FIELDS = ['name', 'phone', 'email', 'matter', 'message'];

function validateName(value) {
  if (!value) return MESSAGES.name.required;
  if (value.length < LIMITS.nameMin || !NAME_RE.test(value)) return MESSAGES.name.short;
  if (value.length > LIMITS.nameMax) return MESSAGES.name.long;
  return '';
}

function validatePhone(value) {
  if (!value) return MESSAGES.phone.required;
  if (!PHONE_ALLOWED_RE.test(value)) return MESSAGES.phone.invalid;
  const digits = value.replace(/\D/g, '').length;
  if (digits < LIMITS.phoneMin || digits > LIMITS.phoneMax) return MESSAGES.phone.invalid;
  return '';
}

function validateEmail(value) {
  if (!value) return MESSAGES.email.required;
  if (value.length > LIMITS.emailMax || !EMAIL_RE.test(value)) return MESSAGES.email.invalid;
  return '';
}

function validateMessage(value) {
  if (!value) return MESSAGES.message.required;
  if (value.length < LIMITS.messageMin) return MESSAGES.message.short;
  if (value.length > LIMITS.messageMax) return MESSAGES.message.long;
  return '';
}

const VALIDATORS = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail,
  matter: value => (value ? '' : MESSAGES.matter.required),
  message: validateMessage,
};

// Every rule runs against the trimmed value, so a field of pure whitespace is
// treated exactly like an empty one.
export function validateField(field, value) {
  const validate = VALIDATORS[field];
  return validate ? validate(String(value ?? '').trim()) : '';
}

// Returns only the fields that actually failed, in form order — the caller
// uses the first key to decide which input to focus.
export function validateEnquiry(form) {
  const errors = {};
  for (const field of FIELDS) {
    const error = validateField(field, form[field]);
    if (error) errors[field] = error;
  }
  return errors;
}
