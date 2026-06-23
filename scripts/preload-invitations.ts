import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputPath = args.find((arg) => !arg.startsWith('--')) ?? 'private/invitations.tsv';
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './service-account.json';

type RawRow = Record<string, string>;
type LookupMatch = { invitationId: string; guestName: string; partyName: string };

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function clean(value: string | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function parseNumber(value: string | undefined) {
  const parsed = Number(clean(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTsv(raw: string) {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = lines[0].split('\t').map(clean);
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    return Object.fromEntries(headers.map((header, index) => [header, clean(cells[index])])) as RawRow;
  });
}

function slugFor(row: RawRow, index: number) {
  const base = clean(row['How Name appears on address/envelope']) || clean(row['Names/Family/Couple']) || `invitation-${index + 1}`;
  return normalizeName(base) || `invitation-${index + 1}`;
}

function isSearchableGuestName(name: string) {
  return !['guest', 'wife', 'kid', '& kid'].includes(name.trim().toLowerCase());
}

if (!dryRun && getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath),
  });
}

const rows = parseTsv(readFileSync(inputPath, 'utf8'));
const db = dryRun ? null : getFirestore();
const batch = db?.batch();
const lookupNames = new Map<string, LookupMatch[]>();
const invitationIds = new Set<string>();
let guestCount = 0;

rows.forEach((row, rowIndex) => {
  const names = clean(row['Names/Family/Couple'])
    .split(',')
    .map(clean)
    .filter(Boolean);

  if (names.length === 0) {
    throw new Error(`Row ${rowIndex + 2} has no guest names.`);
  }

  const baseId = slugFor(row, rowIndex);
  let invitationId = baseId;
  let suffix = 2;
  while (invitationIds.has(invitationId)) {
    invitationId = `${baseId}-${suffix}`;
    suffix += 1;
  }
  invitationIds.add(invitationId);

  const envelopeName = clean(row['How Name appears on address/envelope']);
  const partyName = envelopeName || names.join(', ');
  const guests = names.map((name, index) => ({ id: `${index + 1}`, name }));
  guestCount += guests.length;

  batch?.set(db.collection('invitations').doc(invitationId), {
    partyName,
    guests,
    envelopeName,
    notes: clean(row.Notes),
    address: {
      line1: clean(row['Address Line 1']),
      line2: clean(row['Address Line 2']),
      city: clean(row.City),
      state: clean(row.State),
      zip: clean(row.Zip),
    },
    counts: {
      kids: parseNumber(row['kid count']),
      invitedPeople: parseNumber(row['Number of Poeple']),
      potentialPlusOnes: parseNumber(row['Potential Plus 1s']),
    },
    source: 'initial-guest-list',
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  guests.forEach((guest) => {
    if (!isSearchableGuestName(guest.name)) return;
    const normalized = normalizeName(guest.name);
    if (!normalized) return;
    lookupNames.set(normalized, [
      ...(lookupNames.get(normalized) ?? []),
      { invitationId, guestName: guest.name, partyName },
    ]);
  });
});

lookupNames.forEach((matches, normalized) => {
  const [firstMatch] = matches;
  batch?.set(db.collection('inviteLookups').doc(normalized), {
    invitationId: matches.length === 1 ? firstMatch.invitationId : null,
    guestName: matches.length === 1 ? firstMatch.guestName : null,
    partyName: matches.length === 1 ? firstMatch.partyName : null,
    matches,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});

await batch?.commit();

console.log(`${dryRun ? 'Validated' : 'Preloaded'} ${rows.length} invitation groups.`);
console.log(`${dryRun ? 'Validated' : 'Preloaded'} ${guestCount} invited guest records.`);
console.log(`${dryRun ? 'Validated' : 'Wrote'} ${lookupNames.size} searchable name lookups.`);
