# Nicole & Brandt Wedding App

Full-stack wedding site built as a static React app for GitHub Pages with Firebase Auth and Firestore.

## Features

- Responsive wedding homepage with event details and schedule
- Invitation-based RSVP form stored in Firestore
- Admin invitation group creation
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
5. Set the `admin` custom claim on admin users.
6. Deploy rules with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

The app uses these collections:

- `invitations`: invitation groups and included guests
- `inviteLookups`: exact-name lookup documents for finding an invitation
- `rsvps`: submitted invitation responses
- `guestbook`: guestbook messages

Create invitation groups from `/admin`. Add one invited guest name per line. Each guest name gets a lookup entry, so any invited person can search their own name and RSVP for everyone included on that invitation. The RSVP captures wedding attendance, welcome-event attendance, meal preference, contact email, optional phone number, and notes. Guests can search again later to edit the RSVP for their invitation.

Firestore admin access is controlled by a private Firebase Auth custom claim instead of public email addresses in the repo. Set it from a trusted Admin SDK environment:

```bash
npm run set-admins
```

To use the script:

1. In Firebase Console, open Project settings > Service accounts.
2. Generate a new private key.
3. Put the downloaded JSON at `service-account.json` in this project folder, or set `FIREBASE_SERVICE_ACCOUNT_PATH`.
4. Make sure each admin email in `.env.local` has signed in at least once.
5. Run `npm run set-admins`.

The service account file is ignored by git. Do not commit it.

For a public site, enable Firebase App Check for the web app in the Firebase Console and enforce it for Firestore after confirming invitation lookup, RSVP, and guestbook submissions work in production.

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
