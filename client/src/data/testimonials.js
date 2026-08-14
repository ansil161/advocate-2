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
export const testimonials = [];
