# Nicole & Brandt Wedding App

Full-stack wedding site built as a static React app for GitHub Pages with Firebase Auth and Firestore.

## Features

- Responsive wedding homepage with event details and schedule
- RSVP form stored in Firestore
- Save-the-date contact collection
- Registry links
- Travel, FAQ, and weekend information
- Guestbook form stored in Firestore
- Google sign-in admin panel for reviewing submissions
- GitHub Pages workflow and `nicoleandbrandt.com` custom-domain file

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with your Firebase web app values.

## Firebase Setup

1. Create a Firebase project.
2. Add a Web App and copy the config values into `.env.local`.
3. Enable Authentication, then enable Google as a sign-in provider.
4. Create a Firestore database.
5. Replace the placeholder admin emails in `firebase.rules`.
6. Deploy rules with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

The app writes to these collections: `rsvps`, `saveTheDates`, and `guestbook`.

## GitHub Pages

Add these repository secrets before deploying:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_ADMIN_EMAILS`

In the repository settings, set Pages to deploy from GitHub Actions. Point DNS for `nicoleandbrandt.com` to GitHub Pages and keep the included `CNAME` file.
