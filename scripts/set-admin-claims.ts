import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? './service-account.json';
const adminEmails = (process.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

if (adminEmails.length === 0) {
  throw new Error('No admin emails found. Set VITE_ADMIN_EMAILS in .env.local.');
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath),
  });
}

const auth = getAuth();

for (const email of adminEmails) {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, {
    ...user.customClaims,
    admin: true,
  });
  console.log(`Set admin=true for ${email}`);
}

console.log('Done. Admin users must sign out and back in to refresh their token.');
