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
  ceremonyTime: 'TBD',
  city: 'Woodstock, GA',
  venue: "Rocky's Lake Estate",
  venueAddress: '2700 Cox Rd, Woodstock, GA 30188',
  rsvpDeadline: 'TBD',
  email: '',
  registry: [
    { name: 'Zola', description: 'Home, honeymoon, and experiences', url: 'https://www.zola.com/' },
    { name: 'Target', description: 'Everyday home essentials', url: 'https://www.target.com/gift-registry' },
    { name: 'Amazon', description: 'Kitchen, travel, and hosting favorites', url: 'https://www.amazon.com/wedding' },
  ],
  schedule: [
    { time: 'Friday - TBD', title: 'Welcome event', detail: 'Location and time TBD.' },
    { time: '4:00 PM', title: 'Guest arrival', detail: 'Garden gates open with light refreshments.' },
    { time: '4:30 PM', title: 'Ceremony', detail: 'Outdoor ceremony in the west garden.' },
    { time: '5:15 PM', title: 'Cocktail hour', detail: 'Passed bites, bar service, and photos.' },
    { time: '6:30 PM', title: 'Dinner', detail: 'Seated dinner followed by toasts.' },
    { time: '8:00 PM', title: 'Dancing', detail: 'Music, dessert, and late-night snacks.' },
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
