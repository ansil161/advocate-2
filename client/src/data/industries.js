// Industries served — inferred from the firm's practice-area breadth (banking/recovery focus,
// real estate, corporate, consumer). No industry-specific case data was supplied, so detail
// pages stay intentionally light (stub) rather than inventing client history.

export const industries = [
  { slug: 'banking-nbfcs', name: 'Banking & NBFCs', note: 'DRT, SARFAESI and recovery litigation for institutional lenders.' },
  { slug: 'real-estate-developers', name: 'Real Estate & Developers', note: 'Title verification, RERA compliance and builder-buyer disputes.' },
  { slug: 'corporate-startups', name: 'Corporate & Startups', note: 'Incorporation, contracts, and commercial dispute resolution.' },
  { slug: 'insurance-companies', name: 'Insurance Companies', note: 'Claims defense and consumer insurance dispute representation.' },
  { slug: 'healthcare-hospitals', name: 'Healthcare & Hospitals', note: 'Medical negligence defense and consumer forum representation.' },
  { slug: 'educational-institutions', name: 'Educational Institutions', note: 'Admissions, affiliation and constitutional matters.' },
  { slug: 'manufacturing-trading', name: 'Manufacturing & Trading', note: 'Commercial recovery, labour and industrial dispute matters.' },
  { slug: 'housing-societies-rwas', name: 'Housing Societies & RWAs', note: 'Society disputes, elections and management-body representation.' },
];

export const getIndustryBySlug = slug => industries.find(i => i.slug === slug);
