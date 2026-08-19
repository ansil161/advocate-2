export const consult = {
  onlineSlots: 4,
  // How the online slots are split across the day. The fact was previously
  // written out by hand in three places — Contact.jsx, Consult.jsx and the AI
  // service's knowledge builder — with only the total living here, so changing
  // the total would have left the assistant asserting a split that no longer
  // added up. These two fields are the authoritative source for it.
  //
  // Purely additive: no component reads them yet, so nothing on the site
  // renders differently. The AI service derives its sentence from them and
  // drops the detail entirely if it stops summing to onlineSlots, so the
  // knowledge base degrades to a weaker true statement rather than a confident
  // wrong one.
  onlineMorning: 2,
  onlineEvening: 2,
  offlineSlots: 3,
  phone: '+91 99124 16770',
  phoneHref: '+919912416770',
  email: 'slaadvocates.hyd@gmail.com',
  instagram: '@SLA_Advocates',
  instagramHref: 'https://instagram.com/SLA_Advocates',
  city: 'Hyderabad, Telangana',
};
