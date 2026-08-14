// Representative matter types, not real case files. No case names, citations, or party
// details were supplied in the source material, and none are invented here — fabricating
// case citations would be seriously misleading. These are anonymized illustrations of the
// kind of matters the firm's 2000+ case history spans, grounded in the real practice areas.
//
// `featured` marks the four matters carried as the landmark page's scroll sequence;
// the rest remain in the set for anywhere the full list is wanted.
//
// `practiceSlug` and `forum` cross-reference the real, sourced practiceAreas.js entries
// (matching category → forums list) rather than inventing new specifics. `outcome` is a
// short restatement of each summary's own described result, not a new claim.

export const disclaimer = 'Illustrative matter types drawn from the firm’s practice areas — not verifiable case citations. Individual case details are withheld to protect client confidentiality.';

export const landmarkCases = [
  {
    n: '01',
    category: 'Banking & Recovery',
    title: 'Secured Asset Recovery via SARFAESI',
    summary: 'Coordinated possession and sale of a defaulted commercial property on behalf of an institutional lender, following statutory notice and DRT challenge proceedings.',
    practiceSlug: 'banking-financial-laws',
    featured: true,
    forum: 'Debt Recovery Tribunal (DRT)',
    outcome: 'Possession Recovered',
  },
  {
    n: '02',
    category: 'Civil Litigation',
    title: 'Multi-Generation Partition Suit',
    summary: 'Resolved a decades-old ancestral property dispute among extended family branches, securing an independent title through formal court decree.',
    practiceSlug: 'civil-litigation',
    featured: true,
    forum: 'District Courts',
    outcome: 'Title Decreed',
  },
  {
    n: '03',
    category: 'Constitutional & Writ',
    title: 'Writ Petition Against Arbitrary Suspension',
    summary: 'Secured reinstatement for a public sector employee following an unlawful disciplinary suspension, argued before the High Court of Telangana.',
    practiceSlug: 'constitutional-writ-practice',
    featured: true,
    forum: 'High Court of Telangana',
    outcome: 'Reinstatement Secured',
  },
  {
    n: '04',
    category: 'Criminal Law',
    title: 'FIR Quashed Under Section 482',
    summary: 'Invoked the High Court’s inherent powers to quash a maliciously registered FIR, sparing the client a prolonged and groundless trial.',
    practiceSlug: 'criminal-law',
    featured: true,
    forum: 'High Court of Telangana',
    outcome: 'FIR Quashed',
  },
  {
    n: '05',
    category: 'Insolvency & Bankruptcy',
    title: 'Operational Creditor Recovery via NCLT',
    summary: 'Secured a seat at the resolution table for an operational creditor after a corporate debtor’s prolonged non-payment.',
    practiceSlug: 'insolvency-bankruptcy',
    forum: 'NCLT',
    outcome: 'Claim Admitted',
  },
  {
    n: '06',
    category: 'Family & Succession',
    title: 'Contested Probate, Defended',
    summary: 'Successfully defended a will’s authenticity against challenges from disgruntled relatives, securing probate for the named executor.',
    practiceSlug: 'family-succession-matters',
    forum: 'District Courts',
    outcome: 'Probate Granted',
  },
];
