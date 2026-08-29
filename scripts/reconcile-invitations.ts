import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  getFirestore,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';

config({ path: '.env.local' });

type LookupMatch = { invitationId: string; guestName: string; partyName: string };
type InvitationRecord = {
  id: string;
  ref: DocumentReference;
  partyName: string;
  guestNames: string[];
  fingerprint: string | null;
  createdAtMillis: number;
};
type DuplicateGroup = {
  canonicalInvitationId: string;
  duplicateInvitationIds: string[];
  rsvpReferenceCount: number;
  emailLookupReferenceCount: number;
  subcollections: Record<string, string[]>;
};
type ExplicitInvitationDeletion = {
  invitationId: string;
  rsvpReferenceCount: number;
  emailLookupReferenceCount: number;
  subcollections: string[];
};
type ReconciliationReport = {
  mode: 'dry-run' | 'apply';
  invitations: number;
  exactDuplicateGroups: number;
  invitationsToDelete: number;
  protectedDuplicateGroups: DuplicateGroup[];
  protectedRequestedDeletions: ExplicitInvitationDeletion[];
  requestedInvitationDeletions: ExplicitInvitationDeletion[];
  invitationsWithNoSearchableGuestNames: string[];
  inviteLookups: {
    existing: number;
    expected: number;
    toDelete: number;
    toRebuild: number;
  };
  inviteNameSearch: {
    existing: number;
    expected: number;
    toDelete: number;
    toRebuild: number;
  };
  duplicateGroups: DuplicateGroup[];
};
type Scan = {
  invitations: InvitationRecord[];
  existingLookups: Map<string, QueryDocumentSnapshot>;
  existingNameSearch: Map<string, QueryDocumentSnapshot>;
  rsvpReferenceCounts: Map<string, number>;
  emailLookupReferenceCounts: Map<string, number>;
};

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? './service-account.json';

function usage() {
  console.log('Usage: npm run reconcile-invitations -- [--dry-run | --apply] [--delete-invitation ID]');
  console.log('  --dry-run  Inspect and report only (the default).');
  console.log('  --apply    Apply the previewed cleanup.');
  console.log('  --delete-invitation ID  Explicitly delete one invitation after safety checks.');
}

function parseOptions(args: string[]) {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(0);
  }

  const explicitInvitationIds: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run' || arg === '--apply') continue;
    if (arg === '--delete-invitation') {
      const invitationId = args[index + 1];
      if (!invitationId || invitationId.startsWith('--')) {
        usage();
        throw new Error('--delete-invitation requires an invitation ID.');
      }
      explicitInvitationIds.push(invitationId);
      index += 1;
      continue;
    }
    usage();
    throw new Error(`Unknown argument: ${arg}`);
  }

  const apply = args.includes('--apply');
  if (args.includes('--dry-run') && apply) {
    usage();
    throw new Error('--dry-run and --apply cannot be combined.');
  }

  return { apply, explicitInvitationIds: Array.from(new Set(explicitInvitationIds)) };
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function isSearchableGuestName(name: string) {
  return !['guest', 'wife', 'kid', '& kid'].includes(name.trim().toLowerCase());
}

function searchKeysForName(name: string) {
  const normalized = normalizeName(name);
  const tokens = normalized.split('-').filter(Boolean);
  const keys = new Set([normalized]);

  if (tokens.length >= 2) {
    const lastName = tokens[tokens.length - 1];
    keys.add(lastName);
    keys.add(`${lastName}-${tokens.slice(0, -1).join('-')}`);
  }

  return Array.from(keys).filter((key) => key.length >= 2);
}

function guestNamesFromData(data: DocumentData) {
  if (!Array.isArray(data.guests)) return [];
  return data.guests
    .map((guest) => clean(guest && typeof guest === 'object' ? (guest as Record<string, unknown>).name : undefined))
    .filter(Boolean);
}

function timestampMillis(value: unknown) {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return { timestamp: value.toMillis() };
    }
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableValue(record[key])]));
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value)) ?? 'undefined';
}

function invitationFingerprint(data: DocumentData) {
  return stableJson(Object.fromEntries(
    Object.entries(data).filter(([key]) => key !== 'createdAt' && key !== 'updatedAt'),
  ));
}

function invitationFromSnapshot(snapshot: QueryDocumentSnapshot) {
  const data = snapshot.data();
  const guestNames = guestNamesFromData(data);
  const partyName = clean(data.partyName) || guestNames.join(', ');
  const hasSearchableGuest = guestNames.some((name) => isSearchableGuestName(name) && Boolean(normalizeName(name)));

  return {
    id: snapshot.id,
    ref: snapshot.ref,
    partyName,
    guestNames,
    fingerprint: hasSearchableGuest ? invitationFingerprint(data) : null,
    createdAtMillis: timestampMillis(data.createdAt),
  } satisfies InvitationRecord;
}

function matchesForInvitation(invitation: InvitationRecord) {
  const matches = new Map<string, LookupMatch>();
  invitation.guestNames.forEach((guestName) => {
    if (!isSearchableGuestName(guestName)) return;
    const normalizedName = normalizeName(guestName);
    if (!normalizedName) return;
    matches.set(normalizedName, {
      invitationId: invitation.id,
      guestName,
      partyName: invitation.partyName,
    });
  });
  return Array.from(matches.values());
}

function sortedMatches(matches: LookupMatch[]) {
  return [...matches].sort((left, right) => (
    left.invitationId.localeCompare(right.invitationId)
    || left.guestName.localeCompare(right.guestName)
  ));
}

function referenceCountsByInvitation(snapshot: { docs: QueryDocumentSnapshot[] }) {
  const references = new Map<string, number>();
  snapshot.docs.forEach((document) => {
    const invitationId = clean(document.data().invitationId);
    if (!invitationId) return;
    references.set(invitationId, (references.get(invitationId) ?? 0) + 1);
  });
  return references;
}

function chooseCanonical(records: InvitationRecord[]) {
  return [...records].sort((left, right) => (
    left.createdAtMillis - right.createdAtMillis
    || left.id.localeCompare(right.id)
  ))[0];
}

function indexById(snapshot: { docs: QueryDocumentSnapshot[] }) {
  return new Map(snapshot.docs.map((document) => [document.id, document]));
}

function expectedLookupData(matches: LookupMatch[]) {
  const sorted = sortedMatches(matches);
  const [onlyMatch] = sorted;
  return {
    invitationId: sorted.length === 1 ? onlyMatch.invitationId : null,
    guestName: sorted.length === 1 ? onlyMatch.guestName : null,
    partyName: sorted.length === 1 ? onlyMatch.partyName : null,
    matches: sorted,
  };
}

function expectedNameSearchData(record: LookupMatch & { searchKey: string }) {
  return {
    invitationId: record.invitationId,
    guestName: record.guestName,
    partyName: record.partyName,
    searchKey: record.searchKey,
  };
}

function needsRebuild(document: QueryDocumentSnapshot | undefined, expected: Record<string, unknown>) {
  if (!document) return true;
  const existing = Object.fromEntries(Object.entries(document.data()).filter(([key]) => key !== 'createdAt' && key !== 'updatedAt'));
  return stableJson(existing) !== stableJson(expected);
}

function deriveLookupRecords(records: InvitationRecord[]) {
  const expectedLookups = new Map<string, LookupMatch[]>();
  const expectedNameSearch = new Map<string, LookupMatch & { searchKey: string }>();

  records.forEach((invitation) => {
    matchesForInvitation(invitation).forEach((match) => {
      const normalizedName = normalizeName(match.guestName);
      expectedLookups.set(normalizedName, [
        ...(expectedLookups.get(normalizedName) ?? []),
        match,
      ]);
      searchKeysForName(match.guestName).forEach((searchKey) => {
        expectedNameSearch.set(`${searchKey}__${match.invitationId}__${normalizedName}`, {
          ...match,
          searchKey,
        });
      });
    });
  });

  return { expectedLookups, expectedNameSearch };
}

const { apply, explicitInvitationIds } = parseOptions(process.argv.slice(2));
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8')) as { project_id?: unknown };
const serviceAccountProjectId = clean(serviceAccount.project_id);
const configuredProjectId = clean(process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID);

if (configuredProjectId && serviceAccountProjectId && configuredProjectId !== serviceAccountProjectId) {
  throw new Error('The service account project does not match the configured Firebase project. Refusing to continue.');
}
if (apply && !configuredProjectId) {
  throw new Error('FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID is required for --apply. Refusing to run against an unconfirmed project.');
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccountPath), projectId: serviceAccountProjectId || undefined });
}

const db = getFirestore();

async function scan(): Promise<Scan> {
  const [invitationSnapshot, lookupSnapshot, nameSearchSnapshot, rsvpSnapshot, emailLookupSnapshot] = await Promise.all([
    db.collection('invitations').get(),
    db.collection('inviteLookups').get(),
    db.collection('inviteNameSearch').get(),
    db.collection('rsvps').get(),
    db.collection('rsvpEmailLookups').get(),
  ]);
  return {
    invitations: invitationSnapshot.docs.map(invitationFromSnapshot),
    existingLookups: indexById(lookupSnapshot),
    existingNameSearch: indexById(nameSearchSnapshot),
    rsvpReferenceCounts: referenceCountsByInvitation(rsvpSnapshot),
    emailLookupReferenceCounts: referenceCountsByInvitation(emailLookupSnapshot),
  };
}

const initial = await scan();
const invitationsById = new Map(initial.invitations.map((invitation) => [invitation.id, invitation]));
const missingRequestedInvitationIds = explicitInvitationIds.filter((id) => !invitationsById.has(id));
if (missingRequestedInvitationIds.length > 0) {
  throw new Error(`Requested invitation${missingRequestedInvitationIds.length === 1 ? '' : 's'} not found: ${missingRequestedInvitationIds.join(', ')}`);
}

const requestedDeletionChecks = await Promise.all(explicitInvitationIds.map(async (invitationId) => {
  const invitation = invitationsById.get(invitationId);
  if (!invitation) throw new Error(`Invitation not found: ${invitationId}`);
  return {
    invitationId,
    rsvpReferenceCount: initial.rsvpReferenceCounts.get(invitationId) ?? 0,
    emailLookupReferenceCount: initial.emailLookupReferenceCounts.get(invitationId) ?? 0,
    subcollections: (await invitation.ref.listCollections()).map((collection) => collection.id),
  } satisfies ExplicitInvitationDeletion;
}));
const blockedRequestedDeletions = requestedDeletionChecks.filter((check) => (
  check.rsvpReferenceCount > 0 || check.emailLookupReferenceCount > 0 || check.subcollections.length > 0
));
const explicitlyDeletedInvitationIds = new Set(explicitInvitationIds);
const invitationsByFingerprint = new Map<string, InvitationRecord[]>();
initial.invitations.forEach((invitation) => {
  if (!invitation.fingerprint) return;
  invitationsByFingerprint.set(invitation.fingerprint, [
    ...(invitationsByFingerprint.get(invitation.fingerprint) ?? []),
    invitation,
  ]);
});

const duplicateGroups: DuplicateGroup[] = [];
const blockedGroups: DuplicateGroup[] = [];
const invitationIdsToDelete = new Set<string>();

for (const records of invitationsByFingerprint.values()) {
  const remainingRecords = records.filter((record) => !explicitlyDeletedInvitationIds.has(record.id));
  if (remainingRecords.length < 2) continue;

  const protectedRecords = remainingRecords.filter((record) => (
    initial.rsvpReferenceCounts.has(record.id) || initial.emailLookupReferenceCounts.has(record.id)
  ));
  const canonical = protectedRecords.length === 1 ? protectedRecords[0] : chooseCanonical(remainingRecords);
  const duplicates = remainingRecords.filter((record) => record.id !== canonical.id);
  const subcollections: Record<string, string[]> = Object.fromEntries(await Promise.all(duplicates.map(async (record) => [
    record.id,
    (await record.ref.listCollections()).map((collection) => collection.id),
  ])));
  const group = {
    canonicalInvitationId: canonical.id,
    duplicateInvitationIds: duplicates.map((record) => record.id).sort(),
    rsvpReferenceCount: remainingRecords.reduce((sum, record) => sum + (initial.rsvpReferenceCounts.get(record.id) ?? 0), 0),
    emailLookupReferenceCount: remainingRecords.reduce((sum, record) => sum + (initial.emailLookupReferenceCounts.get(record.id) ?? 0), 0),
    subcollections,
  } satisfies DuplicateGroup;

  duplicateGroups.push(group);
  const hasMultipleProtectedRecords = protectedRecords.length > 1;
  const hasSubcollections = Object.values(subcollections).some((ids) => ids.length > 0);
  if (hasMultipleProtectedRecords || hasSubcollections) {
    blockedGroups.push(group);
    continue;
  }
  duplicates.forEach((record) => invitationIdsToDelete.add(record.id));
}

explicitInvitationIds.forEach((id) => invitationIdsToDelete.add(id));
const survivingInvitations = initial.invitations.filter((invitation) => !invitationIdsToDelete.has(invitation.id));
const { expectedLookups, expectedNameSearch } = deriveLookupRecords(survivingInvitations);
const report = {
  mode: apply ? 'apply' : 'dry-run',
  invitations: initial.invitations.length,
  exactDuplicateGroups: duplicateGroups.length,
  invitationsToDelete: invitationIdsToDelete.size,
  protectedDuplicateGroups: blockedGroups,
  protectedRequestedDeletions: blockedRequestedDeletions,
  requestedInvitationDeletions: requestedDeletionChecks,
  invitationsWithNoSearchableGuestNames: initial.invitations
    .filter((invitation) => invitation.fingerprint === null)
    .map((invitation) => invitation.id)
    .sort(),
  inviteLookups: {
    existing: initial.existingLookups.size,
    expected: expectedLookups.size,
    toDelete: Array.from(initial.existingLookups.keys()).filter((id) => !expectedLookups.has(id)).length,
    toRebuild: Array.from(expectedLookups.entries()).filter(([id, matches]) => (
      needsRebuild(initial.existingLookups.get(id), expectedLookupData(matches))
    )).length,
  },
  inviteNameSearch: {
    existing: initial.existingNameSearch.size,
    expected: expectedNameSearch.size,
    toDelete: Array.from(initial.existingNameSearch.keys()).filter((id) => !expectedNameSearch.has(id)).length,
    toRebuild: Array.from(expectedNameSearch.entries()).filter(([id, record]) => (
      needsRebuild(initial.existingNameSearch.get(id), expectedNameSearchData(record))
    )).length,
  },
  duplicateGroups,
} satisfies ReconciliationReport;

console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.log('Dry run complete. Re-run with --apply after reviewing this report.');
  process.exit(0);
}

if (blockedGroups.length > 0 || blockedRequestedDeletions.length > 0) {
  throw new Error('Refusing to apply: one or more invitations have RSVP/email references or subcollections. Resolve those records manually, then run again.');
}

let deletionFailure: unknown;
for (const invitationId of invitationIdsToDelete) {
  try {
    const invitationRef = db.collection('invitations').doc(invitationId);
    const rsvpRef = db.collection('rsvps').doc(invitationId);
    const emailLookupQuery = db.collection('rsvpEmailLookups').where('invitationId', '==', invitationId);
    const subcollections = await invitationRef.listCollections();
    if (subcollections.length > 0) {
      throw new Error(`Refusing to delete ${invitationId}: it now has subcollections.`);
    }
    await db.runTransaction(async (transaction) => {
      const [invitation, rsvp, emailLookups] = await Promise.all([
        transaction.get(invitationRef),
        transaction.get(rsvpRef),
        transaction.get(emailLookupQuery),
      ]);
      if (!invitation.exists) throw new Error(`Refusing to delete ${invitationId}: it no longer exists.`);
      if (rsvp.exists || !emailLookups.empty) {
        throw new Error(`Refusing to delete ${invitationId}: it received an RSVP or email lookup during reconciliation.`);
      }
      transaction.delete(invitationRef);
    });
  } catch (error) {
    deletionFailure = error;
    break;
  }
}

const fresh = await scan();
const { expectedLookups: freshExpectedLookups, expectedNameSearch: freshExpectedNameSearch } = deriveLookupRecords(fresh.invitations);
const writer = db.bulkWriter();
writer.onWriteError((error) => {
  console.error(`Firestore write failed for ${error.documentRef.path}: ${error.message}`);
  return error.failedAttempts < 3;
});

fresh.existingLookups.forEach((document, id) => {
  if (!freshExpectedLookups.has(id)) writer.delete(document.ref);
});
fresh.existingNameSearch.forEach((document, id) => {
  if (!freshExpectedNameSearch.has(id)) writer.delete(document.ref);
});
freshExpectedLookups.forEach((matches, normalizedName) => {
  const existing = fresh.existingLookups.get(normalizedName);
  const expected = expectedLookupData(matches);
  if (!needsRebuild(existing, expected)) return;
  writer.set(db.collection('inviteLookups').doc(normalizedName), {
    ...expected,
    createdAt: existing?.data().createdAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});
freshExpectedNameSearch.forEach((record, id) => {
  const existing = fresh.existingNameSearch.get(id);
  const expected = expectedNameSearchData(record);
  if (!needsRebuild(existing, expected)) return;
  writer.set(db.collection('inviteNameSearch').doc(id), {
    ...expected,
    createdAt: existing?.data().createdAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
});

await writer.close();
if (deletionFailure) throw deletionFailure;
console.log('Reconciliation complete. Run the dry run once more to confirm the final counts.');
