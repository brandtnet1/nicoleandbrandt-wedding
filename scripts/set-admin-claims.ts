import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

config({ path: '.env.local' });

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
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, {
      ...user.customClaims,
      admin: true,
    });
    console.log(`Set admin=true for ${email}`);
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'auth/user-not-found') {
      console.warn(`Skipped ${email}: user has not signed in yet`);
      continue;
    }
    throw error;
  }
}

console.log('Done. Admin users must sign out and back in to refresh their token.');
