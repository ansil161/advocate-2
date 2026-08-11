// Recognition & credentials — built only from facts present in the source material.
// No specific award names, press logos, or media citations were supplied, so this page
// presents verifiable credentials rather than inventing accolades.

import { stats } from './firm.js';
import { practiceAreas } from './practiceAreas.js';

export const credentials = [
  { value: 2000, suffix: '+', label: 'Cases Handled' },
  { value: 75, suffix: '%+', label: 'Success Rate' },
  { value: null, display: 'TS/286/1996', label: 'Bar Council of Telangana — Founder Enrollment' },
  { value: 75, suffix: '+ Yrs', label: 'Combined Courtroom Experience' },
];

export const barCouncilEnrollments = [
  { name: 'Sridhar Lendalay', role: 'Senior Advocate & Founder', enrollment: 'TS/286/1996', since: '1996' },
  { name: 'Palanati Lakshman', role: 'Senior Advocate', enrollment: 'TS/1124/2008', since: '2008' },
  { name: 'T.V. Arvind', role: 'Advocate', enrollment: 'TS/1967/2015', since: '2015' },
  { name: 'Vinesh Lendalay', role: 'Associate Advocate', enrollment: 'TS/167/2022', since: '2022' },
  { name: 'Beemanaboina Krupakar', role: 'Advocate', enrollment: 'TS 1656/24', since: '2024' },
];

export const milestones = [
  { year: '1996', title: 'Called to the Bar', body: 'Sridhar Lendalay enrolled with the Bar Council of Telangana after completing his LLB from Osmania University.' },
  { year: '2005', title: 'Independent Practice', body: 'After years under senior mentorship, independent litigation practice began.' },
  { year: '2012–2015', title: 'The Bench Grows', body: 'Palanati Lakshman and T.V. Arvind join, forming the firm’s core litigation strength.' },
  { year: '2013', title: 'SLA Advocates Founded', body: 'Sridhar Lendalay Associates Advocates is established in Hyderabad.' },
  { year: '2021–2024', title: 'Full-Service Bench', body: 'Manjula, Vinesh, Krupakar, Akshay, Pavan, Karthik and Bharath join — bringing the team to eleven.' },
  { year: 'Today', title: '2000+ Cases, 75%+ Success', body: 'Regular appearances before the High Court, City Civil Courts, DRT and NCLT across Telangana.' },
];

export const recognitionQuote = {
  quote: 'Our credibility is measured in outcomes, not accolades.',
  attribution: 'SLA Advocates',
};

// ── THE RECORD ────────────────────────────────────────────────────────────────
// The four figures the Awards page is built around. Values are read out of
// data/firm.js rather than restated here, so the Awards page can never drift from
// the firm-wide numbers. Only the label wording is page-specific; no value is
// transformed, rounded or invented.
const fromStats = (statLabel, label) => {
  const s = stats.find((x) => x.label === statLabel);
  return s ? { value: s.value, suffix: s.suffix, label, note: s.sub } : null;
};

export const record = [
  fromStats('Cases Handled', 'Cases Handled'),
  fromStats('Success Rate', 'Success Rate'),
  fromStats('Years at the Bar', 'Years at the Bar'),
  fromStats('Combined Years', 'Combined Courtroom Experience'),
].filter(Boolean);

// ── REGULAR APPEARANCES ───────────────────────────────────────────────────────
// The forums the firm appears before. Each is annotated with the practice areas
// that already list that forum in data/practiceAreas.js — the annotation is derived,
// never asserted, so nothing here can claim a presence the practice data doesn't.
const FORUM_MATCHES = {
  'High Court of Telangana': ['High Court of Telangana'],
  'City Civil Courts, Hyderabad': ['City Civil Courts'],
  'District Courts': ['District Courts'],
  'Debt Recovery Tribunal (DRT)': ['Debt Recovery Tribunal (DRT)'],
  'National Company Law Tribunal (NCLT)': ['NCLT'],
  'Consumer Commissions': ['Consumer Commissions', 'District Consumer Commission', 'State Commission', 'NCDRC'],
  'Labour Courts': ['Labour Courts'],
};

export const forums = Object.entries(FORUM_MATCHES).map(([name, matches]) => ({
  name,
  domains: practiceAreas.filter((p) => p.forums?.some((f) => matches.includes(f))).map((p) => p.title),
}));
