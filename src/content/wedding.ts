type WeddingFaq = {
  q: string;
  a: string;
  link?: {
    label: string;
    to: string;
  };
};

export const wedding: {
  couple: string;
  date: string;
  ceremonyTime: string;
  city: string;
  venue: string;
  venueAddress: string;
  rsvpDeadline: string;
  email: string;
  registry: { name: string; description: string; url: string }[];
  schedule: { time: string; title: string; detail: string }[];
  faqs: WeddingFaq[];
} = {
  couple: 'Nicole & Brandt',
  date: 'Saturday, November 28, 2026',
  ceremonyTime: '4:00 PM',
  city: 'Woodstock, GA',
  venue: "Rocky's Lake Estate",
  venueAddress: '2700 Cox Rd, Woodstock, GA 30188',
  rsvpDeadline: 'Friday, October 23rd, 2026',
  email: '',
  registry: [],
  schedule: [
    { time: 'Friday - 3:00 PM', title: 'Welcome event', detail: 'Variant Brewing \n 66 Norcross St, Roswell, GA 30075 \n Additional parking can be found across the street at Roswell City Hall' },
    { time: 'Saturday - 3:30 PM', title: 'Guest arrival', detail: 'Rockys Lake Estate gates open with light refreshments.' },
    { time: '4:00 PM', title: 'Ceremony', detail: 'Lakefront ceremony in the garden.' },
    { time: '4:30 PM', title: 'Cocktail hour', detail: 'Passed bites, bar service, and photos.' },
    { time: '5:30 PM', title: 'Dinner', detail: 'Seated dinner followed by toasts.' },
    { time: '7:00 PM', title: 'Dancing', detail: 'Music, dessert, and late-night snacks.' },
  ],
  faqs: [
    { q: 'What should I wear?', a: 'Formal.' },
    { q: 'Can I bring a plus one?', a: 'Please check your invitation. If a guest is listed, include them when submitting your RSVP.' },
    { q: 'Are kids invited?', a: 'Yes. Kids are welcome to celebrate with us.' },
    {
      q: 'Where should I stay?',
      a: 'We have shared a few recommended Alpharetta-area hotels on our Travel page. Please book directly with the hotel; any room-block or transportation updates will be shared there.',
      link: { label: 'View hotel recommendations', to: '/travel' },
    },
  ],
};
