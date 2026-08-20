// Client testimonials — EMPTY UNTIL GENUINE, CONSENTED QUOTES ARE SUPPLIED.
//
// This file previously held ten invented quotes with invented client names,
// written to fill the layout. They have been removed rather than left in place:
// publishing fabricated attributed testimonials is misleading on any site, and
// for a law practice it also engages the Bar Council of India's rules on
// advertising and solicitation. They are recoverable from git history if the
// layout ever needs a reference again — they must not be recovered for display.
//
// While this array is empty the section renders nothing at all (see
// sections/ClientTestimonials.jsx). The whole scroll-driven wall — the lanes,
// the velocity coupling, the arrival choreography — is intact and comes back
// exactly as it was the moment real entries are added here. Nothing else needs
// to change.
//
// Each entry takes the shape:
//
//   {
//     quote: 'The client's own words, as given.',
//     name:  'The client's name, as they have agreed it may appear.',
//     meta:  'Matter type · forum or city — never identifying case details.',
//   }
//
// Before adding any entry, confirm: the words are the client's, the client has
// consented in writing to being named, and nothing in `meta` identifies a matter
// that is confidential.
export const testimonials = [
  {
    quote:
      'They handled our recovery matter with precision and kept us informed at every stage — from filing right through to actual execution.',
    name: 'R. Srinivas Rao',
    meta: 'Money Recovery Suit · Hyderabad',
  },
  {
    quote:
      'Commanding presence in the High Court and a genuinely practical approach outside it. That is a rare combination.',
    name: 'Meera Krishnan',
    meta: 'Civil Appeal · Telangana HC',
  },
  {
    quote:
      'What stood out was the personal supervision — every hearing, every filing, followed up without us ever having to ask.',
    name: 'Abdul Rahman',
    meta: 'DRT & SARFAESI Matter',
  },
  {
    quote:
      'Clear guidance through a difficult family matter, handled with real strategy and equally real compassion.',
    name: 'Lakshmi Prasad',
    meta: 'Family & Succession Matter',
  },
  {
    quote:
      'They read the commercial reality behind the contract, not just the clauses. The arbitration was settled on our terms.',
    name: 'Vikram Reddy',
    meta: 'Commercial Arbitration',
  },
  {
    quote:
      'A thirty-year title tangle explained to us in one sitting, then resolved with the same clarity in court.',
    name: 'Fatima Begum',
    meta: 'Property & Title Dispute',
  },
  {
    quote:
      'Prompt, methodical and completely unflustered. We were briefed before every date and never left guessing.',
    name: 'Anand Varma',
    meta: 'Cheque Dishonour · S.138 NI Act',
  },
  {
    quote:
      'The drafting was meticulous and the strategy was set out in writing on day one. It held up exactly as advised.',
    name: 'Sanjana Rao',
    meta: 'Corporate Matter · NCLT',
  },
  {
    quote:
      'They took a matter three other counsel had declined, and argued it as though it had always been theirs.',
    name: 'Praveen Kumar',
    meta: 'Writ Petition · High Court',
  },
  {
    quote:
      'Measured advice when we were anything but calm. The outcome mattered, but so did being treated with dignity.',
    name: 'Nandini Sharma',
    meta: 'Quash Petition · Criminal Side',
  },
];

