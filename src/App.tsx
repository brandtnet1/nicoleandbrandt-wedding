import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FlightIcon from '@mui/icons-material/Flight';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SendIcon from '@mui/icons-material/Send';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAt,
  endAt,
  writeBatch,
} from 'firebase/firestore';
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { Link as RouterLink, NavLink, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, firebaseEnabled, googleProvider } from './lib/firebase';
import { wedding } from './content/wedding';

type Status = 'idle' | 'saving' | 'saved' | 'error';
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type GuestRecord = Record<string, unknown> & { id: string };
type InvitationGuest = { id: string; name: string };
type InvitationAdminRecord = GuestRecord & {
  partyName?: string;
  envelopeName?: string;
  guests?: InvitationGuest[];
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  counts?: {
    kids?: number | null;
    invitedPeople?: number | null;
    potentialPlusOnes?: number | null;
  };
  notes?: string;
};
type Invitation = {
  id: string;
  partyName: string;
  guests: InvitationGuest[];
};
type LookupMatch = { invitationId: string; guestName: string; partyName: string };
type Attendance = 'yes' | 'no';
type RsvpResponse = { name: string; wedding: Attendance; welcomeEvent: Attendance };
type GuestResponse = Record<string, RsvpResponse>;
type RsvpRecord = {
  id: string;
  invitationId: string;
  invitationName: string;
  contactEmail: string;
  contactPhone?: string;
  responses: RsvpResponse[];
};
type GuestbookRecord = GuestRecord & {
  name?: string;
  message?: string;
};

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Travel', path: '/travel' },
  { label: 'Registry', path: '/registry' },
  { label: 'Guestbook', path: '/guestbook' },
];

const weddingDate = new Date('2026-11-28T16:00:00-05:00');

function firebaseMessage() {
  return firebaseEnabled
    ? null
    : 'Firebase is not configured yet. Add your VITE_FIREBASE_* values to .env.local to enable live submissions.';
}

async function save(collectionName: string, payload: Record<string, unknown>) {
  if (!db) throw new Error('Firebase is not configured.');
  await addDoc(collection(db, collectionName), { ...payload, createdAt: serverTimestamp() });
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

function isSearchableGuestName(name: string) {
  return !['guest', 'wife', 'kid', '& kid'].includes(name.trim().toLowerCase());
}

function uniqueMatches(matches: LookupMatch[]) {
  return Array.from(new Map(matches.map((match) => [`${match.invitationId}:${match.guestName}`, match])).values());
}

function uniqueInvitationMatches(matches: LookupMatch[]) {
  return Array.from(new Map(matches.map((match) => [match.invitationId, match])).values());
}

async function searchInvitationNames(term: string) {
  if (!db) throw new Error('Firebase is not configured.');
  const normalized = normalizeName(term);
  if (normalized.length < 2) return [];
  const snapshot = await getDocs(query(
    collection(db, 'inviteNameSearch'),
    orderBy('searchKey'),
    startAt(normalized),
    endAt(`${normalized}\uf8ff`),
    limit(12),
  ));
  return uniqueInvitationMatches(snapshot.docs.map((document) => document.data() as LookupMatch));
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function authErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === 'auth/unauthorized-domain') {
      return 'This domain is not authorized in Firebase Auth. Add nicoleandbrandt.com and brandtnet1.github.io in Firebase Console > Authentication > Settings > Authorized domains.';
    }
    if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled in Firebase.';
    if (code === 'auth/popup-closed-by-user') return 'The Google sign-in popup was closed before login completed.';
    if (code === 'auth/popup-blocked') return 'The browser blocked the Google sign-in popup.';
    return `Google sign-in failed: ${code}`;
  }
  return 'Google sign-in failed.';
}

function App() {
  const location = useLocation();

  return (
    <Box className="app-shell">
      <Nav />
      <Box component="main" className="page-main">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><HomeOrRsvp /></PageTransition>} />
            <Route path="/rsvp" element={<PageTransition><RsvpPage /></PageTransition>} />
            <Route path="/rsvp/:invitationId" element={<PageTransition><RsvpPage /></PageTransition>} />
            <Route path="/travel" element={<PageTransition><TravelPage /></PageTransition>} />
            <Route path="/registry" element={<PageTransition><RegistryPage /></PageTransition>} />
            <Route path="/guestbook" element={<PageTransition><GuestbookPage /></PageTransition>} />
            <Route path="/admin" element={<PageTransition><AdminPage /></PageTransition>} />
          </Routes>
        </AnimatePresence>
      </Box>
      <Footer />
    </Box>
  );
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: [0.2, 0.9, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

function HomeOrRsvp() {
  const location = useLocation();
  return new URLSearchParams(location.search).has('rsvp') || location.hash.startsWith('#/rsvp/')
    ? <RsvpPage />
    : <Home />;
}

function Nav() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();

  return (
    <AppBar className="glass-nav" color="inherit" elevation={0} position="sticky">
      <Toolbar sx={{ gap: 2 }}>
        <Typography component={RouterLink} to="/" variant="h6" sx={{ color: 'inherit', flexGrow: 1, fontWeight: 800, textDecoration: 'none' }}>
          {wedding.couple}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', md: 'flex' } }}>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={NavLink}
              to={item.path}
              color={location.pathname === item.path ? 'primary' : 'inherit'}
              variant={location.pathname === item.path ? 'outlined' : 'text'}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
        <Tooltip title="Navigation">
          <IconButton onClick={(event) => setAnchor(event.currentTarget)} sx={{ display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {navItems.map((item) => (
            <MenuItem key={item.path} component={RouterLink} to={item.path} onClick={() => setAnchor(null)}>
              {item.label}
            </MenuItem>
          ))}
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <Section title="Wedding Details">
        <Grid container spacing={3}>
          {[
            ['Date', wedding.date],
            ['Ceremony', wedding.ceremonyTime],
            ['Location', `${wedding.venue}, ${wedding.city}`],
          ].map(([label, value], index) => (
            <Grid key={label} size={{ xs: 12, md: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1, ease: [0.2, 0.9, 0.2, 1] }}
              >
                <InfoCard label={label} value={value} />
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Section>
      <Section title="Countdown" tone="ember">
        <Countdown />
      </Section>
      <Section title="Weekend Preview" tone="cream">
        <Paper className="timeline-panel" sx={{ maxWidth: 860, mx: 'auto', overflow: 'hidden' }}>
          {wedding.schedule.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Box
                className="timeline-row"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '132px 1fr' },
                  gap: { xs: 0.5, sm: 3 },
                  p: { xs: 2.5, md: 3 },
                  borderBottom: index === wedding.schedule.length - 1 ? 0 : '1px solid #eadfce',
                }}
              >
                <Typography variant="overline" color="secondary" sx={{ fontWeight: 800 }}>
                  {item.time}
                </Typography>
                <Box>
                  <Typography variant="h5">{item.title}</Typography>
                  <Typography color="text.secondary">{item.detail}</Typography>
                </Box>
              </Box>
            </motion.div>
          ))}
        </Paper>
      </Section>
      <Section title="Travel & FAQ">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.0, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Paper sx={{ p: 3, height: '100%' }}>
                <FlightIcon color="primary" />
                <Typography variant="h5" sx={{ mt: 1 }}>Getting there</Typography>
                <Typography color="text.secondary">Fly into ATL. The venue is north of Atlanta in Woodstock, so guests should plan for extra travel time from the airport, especially with holiday weekend traffic.</Typography>
              </Paper>
            </motion.div>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Paper sx={{ p: 3, height: '100%' }}>
                <RestaurantIcon color="primary" />
                <Typography variant="h5" sx={{ mt: 1 }}>Weekend plans</Typography>
                <Typography color="text.secondary">Hotel blocks, transportation, and welcome details will be added as plans are finalized.</Typography>
              </Paper>
            </motion.div>
          </Grid>
          {wedding.faqs.map((faq, index) => (
            <Grid key={faq.q} size={{ xs: 12, md: 6 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 + index * 0.08, ease: [0.2, 0.9, 0.2, 1] }}
              >
                <Paper sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6">{faq.q}</Typography>
                  <Typography color="text.secondary">{faq.a}</Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Section>
    </>
  );
}

function Hero() {
  return (
    <Box
      component="header"
      className="hero-stage"
      sx={{
        minHeight: { xs: '78svh', md: '84svh' },
        display: 'flex',
        alignItems: 'end',
        color: 'white',
        background:
          'linear-gradient(180deg, rgba(34, 27, 21, .10), rgba(34, 27, 21, .82)), url(https://images.squarespace-cdn.com/content/v1/696bfd55754a6a4c291df382/89c6b496-12a2-4aa6-a890-230cf63f3336/IMG_0304.JPG?format=1000w)',
        backgroundPosition: { xs: 'center top', md: 'center 44%' },
        backgroundSize: 'cover',
      }}
    >
      <Box className="hero-ambient" aria-hidden="true" />
      <Box className="fall-leaves" aria-hidden="true">
        {Array.from({ length: 14 }, (_, index) => (
          <span key={index} style={{ '--i': index } as CSSProperties} />
        ))}
      </Box>
      <Container sx={{ pb: { xs: 7, md: 9 } }}>
        <Stack className="hero-copy" spacing={2.5} sx={{ maxWidth: 760 }}>
          <Chip className="date-chip" label={wedding.date} sx={{ alignSelf: 'start', bgcolor: '#fff8ed', color: '#6f321f', fontWeight: 800 }} />
          <Typography className="hero-title" variant="h1" sx={{ fontSize: { xs: 56, md: 104 }, lineHeight: 0.92 }}>
            {wedding.couple}
          </Typography>
          <Typography variant="h5" sx={{ maxWidth: 660 }}>
            A fall wedding at {wedding.venue} in {wedding.city}.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button className="ghost-button" component={RouterLink} to="/registry" variant="outlined" size="large" sx={{ color: 'white', borderColor: 'white' }}>Registry</Button>
            <Button className="ghost-button" component={RouterLink} to="/guestbook" variant="outlined" size="large" sx={{ color: 'white', borderColor: 'white' }}>Guestbook</Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'cream' | 'ember' }) {
  return (
    <Box className={`section-shell ${tone ? `section-${tone}` : ''}`} component="section" sx={{ py: { xs: 7, md: 10 } }}>
      <Container>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <Typography className="section-title" variant="h2" sx={{ mb: 4, fontSize: { xs: 40, md: 58 } }}>
            {title}
          </Typography>
          {children}
        </motion.div>
      </Container>
    </Box>
  );
}

function PageHeader({ title, eyebrow, children }: { title: string; eyebrow: string; children?: React.ReactNode }) {
  return (
    <Box className="page-header" sx={{ py: { xs: 7, md: 9 }, color: 'white' }}>
      <Container>
        <Stack spacing={1.5} sx={{ alignItems: 'center', maxWidth: 760, mx: 'auto', textAlign: 'center' }}>
          <Typography variant="overline" color="#e7b66d">{eyebrow}</Typography>
          <Typography variant="h1" sx={{ fontSize: { xs: 48, md: 78 }, lineHeight: 0.98 }}>{title}</Typography>
          {children}
        </Stack>
      </Container>
    </Box>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper className="lift-card" sx={{ p: 3, height: '100%' }}>
      <Typography variant="overline" color="secondary">{label}</Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
  );
}

function Countdown() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, weddingDate.getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining / 3_600_000) % 24);
  const minutes = Math.floor((remaining / 60_000) % 60);
  const seconds = Math.floor((remaining / 1_000) % 60);

  return (
    <Box className="countdown-grid">
      {[
        ['Days', days],
        ['Hours', hours],
        ['Minutes', minutes],
        ['Seconds', seconds],
      ].map(([label, value], index) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: index * 0.1, ease: [0.2, 0.9, 0.2, 1] }}
        >
          <Paper className="countdown-tile">
            <Typography variant="h2">{String(value).padStart(2, '0')}</Typography>
            <Typography variant="overline">{label}</Typography>
          </Paper>
        </motion.div>
      ))}
    </Box>
  );
}

function RsvpPage() {
  return (
    <>
      <PageHeader title="RSVP" eyebrow="Celebrate with us">
        <Typography variant="h6">Please respond by {wedding.rsvpDeadline}. Ceremony timing is currently {wedding.ceremonyTime}.</Typography>
      </PageHeader>
      <Section title="Your Response">
        <RsvpForm />
      </Section>
    </>
  );
}

function RsvpForm() {
  const { invitationId } = useParams();
  const location = useLocation();
  const queryInvitationId = new URLSearchParams(location.search).get('rsvp') ?? undefined;
  const hashInvitationId = location.hash.startsWith('#/rsvp/')
    ? decodeURIComponent(location.hash.replace('#/rsvp/', '').split('?')[0] ?? '')
    : undefined;
  const directInvitationId = invitationId ?? queryInvitationId ?? hashInvitationId;
  const [status, setStatus] = useState<Status>('idle');
  const [searchStatus, setSearchStatus] = useState<LoadStatus>('idle');
  const [searchName, setSearchName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [lookupMatches, setLookupMatches] = useState<LookupMatch[]>([]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [responses, setResponses] = useState<GuestResponse>({});
  const [existingRsvpId, setExistingRsvpId] = useState('');
  const [nameSearchNeedsEmail, setNameSearchNeedsEmail] = useState(false);
  const message = firebaseMessage();

  const hasExistingRsvp = async (invitationId: string) => {
    if (!db) throw new Error('Firebase is not configured.');
    return (await getDoc(doc(db, 'rsvps', invitationId))).exists();
  };

  const filterOpenInvitations = async (matches: LookupMatch[]) => {
    const availability = await Promise.all(matches.map(async (match) => ({
      match,
      hasRsvp: await hasExistingRsvp(match.invitationId),
    })));
    return uniqueInvitationMatches(availability.filter((item) => !item.hasRsvp).map((item) => item.match));
  };

  const loadInvitation = async (invitationId: string, mode: 'new' | 'edit' = 'edit') => {
    if (!db) throw new Error('Firebase is not configured.');
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    if (!invitationDoc.exists()) {
      setSearchStatus('loaded');
      return;
    }
    const data = invitationDoc.data();
    const nextInvitation = {
      id: invitationDoc.id,
      partyName: String(data.partyName ?? ''),
      guests: (data.guests ?? []) as InvitationGuest[],
    };
    setInvitation(nextInvitation);
    const rsvpDoc = await getDoc(doc(db, 'rsvps', invitationDoc.id));
    if (rsvpDoc.exists()) {
      if (mode === 'new') {
        setInvitation(null);
        setNameSearchNeedsEmail(true);
        setSearchStatus('loaded');
        return;
      }
      const rsvpData = rsvpDoc.data() as RsvpRecord;
      setExistingRsvpId(rsvpDoc.id);
      setEmail(rsvpData.contactEmail ?? '');
      setPhone(rsvpData.contactPhone ?? '');
      setResponses(Object.fromEntries(nextInvitation.guests.map((guest) => {
        const existing = rsvpData.responses?.find((response) => response.name === guest.name);
        return [
          guest.id,
          existing ? { name: existing.name, wedding: existing.wedding, welcomeEvent: existing.welcomeEvent } : { name: guest.name, wedding: 'yes', welcomeEvent: 'yes' },
        ];
      })));
    } else {
      setExistingRsvpId('');
      setEmail('');
      setPhone('');
      setResponses(Object.fromEntries(nextInvitation.guests.map((guest) => [
        guest.id,
        { name: guest.name, wedding: 'yes', welcomeEvent: 'yes' },
      ])));
    }
    setSearchStatus('loaded');
  };

  useEffect(() => {
    if (!directInvitationId) return;
    setSearchStatus('loading');
    setStatus('idle');
    setInvitation(null);
    setLookupMatches([]);
    setNameSearchNeedsEmail(false);
    loadInvitation(directInvitationId, 'edit').catch(() => setSearchStatus('error'));
  }, [directInvitationId]);

  const searchByName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchStatus('loading');
    setStatus('idle');
    setInvitation(null);
    setLookupMatches([]);
    setNameSearchNeedsEmail(false);
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const lookup = await getDoc(doc(db, 'inviteLookups', normalizeName(searchName)));
      if (!lookup.exists()) {
        const partialMatches = await filterOpenInvitations(await searchInvitationNames(searchName));
        if (partialMatches.length === 1) {
          await loadInvitation(partialMatches[0].invitationId, 'new');
          return;
        }
        setLookupMatches(partialMatches);
        setSearchStatus('loaded');
        return;
      }
      const lookupData = lookup.data();
      const rawMatches = Array.isArray(lookupData.matches)
        ? lookupData.matches as LookupMatch[]
        : lookupData.invitationId
          ? [{ invitationId: String(lookupData.invitationId), guestName: String(lookupData.guestName ?? searchName), partyName: String(lookupData.partyName ?? '') }]
          : [];
      const matches = await filterOpenInvitations(rawMatches);
      if (matches.length > 1) {
        setLookupMatches(matches);
        setSearchStatus('loaded');
        return;
      }
      const invitationId = String(matches[0]?.invitationId ?? lookupData.invitationId ?? '');
      if (!invitationId) {
        setSearchStatus('loaded');
        return;
      }
      await loadInvitation(invitationId, 'new');
    } catch {
      setSearchStatus('error');
    }
  };

  const searchByEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchStatus('loading');
    setStatus('idle');
    setInvitation(null);
    setLookupMatches([]);
    setNameSearchNeedsEmail(false);
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const lookup = await getDoc(doc(db, 'rsvpEmailLookups', normalizeEmail(editEmail)));
      if (!lookup.exists()) {
        setSearchStatus('loaded');
        return;
      }
      await loadInvitation(String(lookup.data().invitationId), 'edit');
    } catch {
      setSearchStatus('error');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invitation) return;
    setStatus('saving');
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const batch = writeBatch(db);
      batch.set(doc(db, 'rsvps', invitation.id), {
        invitationId: invitation.id,
        invitationName: invitation.partyName,
        contactEmail: email,
        contactPhone: phone,
        responses: Object.values(responses),
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'rsvpEmailLookups', normalizeEmail(email)), {
        invitationId: invitation.id,
        contactEmail: normalizeEmail(email),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      setExistingRsvpId(invitation.id);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  const updateResponse = (guest: InvitationGuest, field: 'wedding' | 'welcomeEvent', value: Attendance | null) => {
    if (!value) return;
    setResponses({
      ...responses,
      [guest.id]: {
        name: guest.name,
        wedding: responses[guest.id]?.wedding ?? 'yes',
        welcomeEvent: responses[guest.id]?.welcomeEvent ?? 'yes',
        [field]: value,
      },
    });
  };

  const responseList = invitation ? invitation.guests.map((guest) => responses[guest.id] ?? {
    name: guest.name,
    wedding: 'yes' as Attendance,
    welcomeEvent: 'yes' as Attendance,
  }) : [];
  const weddingYes = responseList.filter((response) => response.wedding === 'yes').length;
  const welcomeYes = responseList.filter((response) => response.welcomeEvent === 'yes').length;
  const activeStep = invitation ? 2 : 0;

  return (
    <Paper className="form-panel rsvp-panel" sx={{ p: { xs: 2, md: 4 }, maxWidth: 980, mx: 'auto' }}>
      <Stack spacing={3}>
        {message && <Alert severity="info">{message}</Alert>}

        <Stack className="rsvp-steps" direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          {['Find invitation', 'Respond for each guest', 'Confirm contact'].map((label, index) => (
            <Chip
              key={label}
              color={index <= activeStep ? 'primary' : 'default'}
              variant={index <= activeStep ? 'filled' : 'outlined'}
              label={`${index + 1}. ${label}`}
            />
          ))}
        </Stack>

        {!invitation && (
          <Box component="form" onSubmit={searchByName}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="h5">Find your invitation</Typography>
                <Typography color="text.secondary">Search your first or last name, then choose your household if more than one invitation matches.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField required fullWidth label="First or last name" value={searchName} onChange={(event) => setSearchName(event.target.value)} />
                <Button type="submit" variant="contained" disabled={searchStatus === 'loading'} sx={{ minWidth: 170 }}>
                  {searchStatus === 'loading' ? 'Searching' : 'Find Invitation'}
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}

        {!invitation && (
          <Paper variant="outlined" className="rsvp-help-panel" sx={{ p: 2 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Already RSVP'd?</Typography>
              <Typography color="text.secondary">
                The easiest way to make changes is the update link in your confirmation email.
              </Typography>
              <Box component="form" onSubmit={searchByEmail}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField required fullWidth type="email" label="RSVP contact email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
                  <Button type="submit" variant="outlined" disabled={searchStatus === 'loading'} sx={{ minWidth: 150 }}>
                    Edit RSVP
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        )}

        {lookupMatches.length > 1 && !invitation && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Typography variant="h6">Choose your invitation</Typography>
              <Typography color="text.secondary">More than one invitation matched that name.</Typography>
              <Stack spacing={1}>
                {lookupMatches.map((match) => (
                  <Button key={match.invitationId} variant="outlined" onClick={() => loadInvitation(match.invitationId, 'new')} sx={{ justifyContent: 'flex-start' }}>
                    {match.partyName}
                  </Button>
                ))}
              </Stack>
            </Stack>
          </Paper>
        )}

        {nameSearchNeedsEmail && <Alert severity="info">This invitation already has an RSVP. To make changes, use the update link in the confirmation email, or enter the RSVP contact email above.</Alert>}
        {searchStatus === 'loaded' && !invitation && lookupMatches.length === 0 && !nameSearchNeedsEmail && <Alert severity="warning">No invitation found. Try a first or last name exactly as it appears on the invitation.</Alert>}
        {searchStatus === 'error' && <Alert severity="error">Unable to search invitations right now.</Alert>}
        {status === 'saved' && <Alert severity="success">You're all set. A confirmation email with an update link will be sent to the contact email.</Alert>}
        {status === 'error' && <Alert severity="error">Unable to submit right now. Check Firebase configuration.</Alert>}
        {invitation && (
          <Box component="form" onSubmit={submit}>
            <Stack spacing={3}>
              <Paper variant="outlined" className="rsvp-found-card" sx={{ p: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                  <Box>
                    <Typography variant="overline" color="text.secondary">Invitation</Typography>
                    <Typography variant="h5">{invitation.partyName}</Typography>
                  </Box>
                  <Chip color={existingRsvpId ? 'secondary' : 'primary'} label={existingRsvpId ? 'Updating RSVP' : 'New RSVP'} />
                </Stack>
              </Paper>

              <Stack spacing={1}>
                <Typography variant="h5">Wedding RSVP</Typography>
                <Typography color="text.secondary">Please answer for each person so we can give catering an accurate count.</Typography>
                {invitation.guests.map((guest, index) => (
                  <motion.div
                    key={`wedding-${guest.id}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.06, ease: [0.2, 0.9, 0.2, 1] }}
                  >
                    <Paper variant="outlined" className="guest-response-row" sx={{ p: 2 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                        <Typography variant="h6">{guest.name}</Typography>
                        <ToggleButtonGroup
                          exclusive
                          color="primary"
                          value={responses[guest.id]?.wedding ?? 'yes'}
                          onChange={(_, value) => updateResponse(guest, 'wedding', value)}
                          aria-label={`${guest.name} wedding RSVP`}
                        >
                          <ToggleButton value="yes">Attending</ToggleButton>
                          <ToggleButton value="no">Not attending</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    </Paper>
                  </motion.div>
                ))}
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h5">Welcome Event</Typography>
                <Typography color="text.secondary">Please answer for the welcome event too. Location and time are still TBD.</Typography>
                {invitation.guests.map((guest, index) => (
                  <motion.div
                    key={`welcome-${guest.id}`}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.06, ease: [0.2, 0.9, 0.2, 1] }}
                  >
                    <Paper variant="outlined" className="guest-response-row" sx={{ p: 2 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
                        <Typography variant="h6">{guest.name}</Typography>
                        <ToggleButtonGroup
                          exclusive
                          color="primary"
                          value={responses[guest.id]?.welcomeEvent ?? 'yes'}
                          onChange={(_, value) => updateResponse(guest, 'welcomeEvent', value)}
                          aria-label={`${guest.name} welcome event RSVP`}
                        >
                          <ToggleButton value="yes">Attending</ToggleButton>
                          <ToggleButton value="no">Not attending</ToggleButton>
                        </ToggleButtonGroup>
                      </Stack>
                    </Paper>
                  </motion.div>
                ))}
              </Stack>

              <Stack spacing={2}>
                <Typography variant="h5">Confirmation</Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField required fullWidth type="email" label="Email for confirmation" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="Phone for future text updates" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </Grid>
                </Grid>
                <Paper variant="outlined" className="rsvp-summary" sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="overline" color="text.secondary">Wedding</Typography>
                      <Typography variant="h5">{weddingYes} attending, {responseList.length - weddingYes} not attending</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="overline" color="text.secondary">Welcome event</Typography>
                      <Typography variant="h5">{welcomeYes} attending, {responseList.length - welcomeYes} not attending</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Stack>

              <Button type="submit" variant="contained" size="large" disabled={status === 'saving'} endIcon={<SendIcon />}>
                {status === 'saving' ? 'Submitting' : existingRsvpId ? 'Update RSVP' : 'Submit RSVP'}
              </Button>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

function RegistryPage() {
  return (
    <>
      <PageHeader title="Registry" eyebrow="Thank you">
        <Typography variant="h6">Registry details are still being finalized.</Typography>
      </PageHeader>
      <Section title="Registry TBD">
        <Paper className="form-panel" sx={{ p: { xs: 3, md: 5 }, maxWidth: 760, mx: 'auto', textAlign: 'center' }}>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            <CelebrationIcon color="secondary" sx={{ fontSize: 44 }} />
            <Typography variant="h4">Coming soon</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 560 }}>
              We will add registry details here once they are ready. Thank you for checking.
            </Typography>
          </Stack>
        </Paper>
      </Section>
    </>
  );
}

function TravelPage() {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venueAddress)}`;
  const appleMapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(wedding.venueAddress)}`;
  const copyAddress = async () => {
    await navigator.clipboard.writeText(`${wedding.venue}, ${wedding.venueAddress}`);
  };

  return (
    <>
      <PageHeader title="Travel" eyebrow="Getting there">
        <Typography variant="h6">{wedding.venue} is in {wedding.city}. Plan for extra travel time from ATL, especially around Thanksgiving weekend.</Typography>
      </PageHeader>
      <Section title="Venue">
        <Grid container spacing={3} sx={{ alignItems: 'stretch' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Paper className="form-panel" sx={{ p: { xs: 3, md: 4 }, height: '100%' }}>
                <Stack spacing={2}>
                  <Typography variant="h4">{wedding.venue}</Typography>
                  <Typography color="text.secondary">{wedding.venueAddress}</Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button component="a" href={googleMapsUrl} target="_blank" rel="noreferrer" variant="outlined">Google Maps</Button>
                    <Button component="a" href={appleMapsUrl} target="_blank" rel="noreferrer" variant="outlined">Apple Maps</Button>
                    <Button variant="outlined" onClick={copyAddress}>Copy address</Button>
                  </Stack>
                </Stack>
              </Paper>
            </motion.div>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Paper className="form-panel" sx={{ p: { xs: 3, md: 4 }, height: '100%' }}>
                <Stack spacing={2}>
                  <FlightIcon color="primary" />
                  <Typography variant="h5">Airport</Typography>
                  <Typography color="text.secondary">Hartsfield-Jackson Atlanta International Airport is the main airport for out-of-town guests. Woodstock is north of Atlanta, so check drive times before leaving.</Typography>
                </Stack>
              </Paper>
            </motion.div>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.2, ease: [0.2, 0.9, 0.2, 1] }}
            >
              <Paper className="form-panel" sx={{ p: { xs: 3, md: 4 } }}>
                <Stack spacing={2}>
                  <RestaurantIcon color="primary" />
                  <Typography variant="h5">Hotels & Transportation</Typography>
                  <Typography color="text.secondary">Hotel blocks, shuttle details, and welcome-event travel notes will be added here once finalized.</Typography>
                </Stack>
              </Paper>
            </motion.div>
          </Grid>
        </Grid>
      </Section>
    </>
  );
}

function GuestbookPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({ name: '', message: '' });
  const message = firebaseMessage();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    try {
      await save('guestbook', form);
      setStatus('saved');
      setForm({ name: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <PageHeader title="Guestbook" eyebrow="Leave a note">
        <Typography variant="h6">Share a memory, a toast, or a message for the wedding weekend.</Typography>
      </PageHeader>
      <Section title="Write A Message">
        <Paper className="form-panel" component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto' }}>
          <Stack spacing={2}>
            {message && <Alert severity="info">{message}</Alert>}
            {status === 'saved' && <Alert severity="success">Message posted.</Alert>}
            {status === 'error' && <Alert severity="error">Unable to submit right now.</Alert>}
            <TextField required fullWidth label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField required fullWidth multiline minRows={4} label="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <Button type="submit" variant="contained" disabled={status === 'saving'} endIcon={<FavoriteIcon />}>Post message</Button>
          </Stack>
        </Paper>
      </Section>
    </>
  );
}

function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hasAdminClaim, setHasAdminClaim] = useState(false);
  const [activeCollection, setActiveCollection] = useState('rsvps');
  const [rows, setRows] = useState<GuestRecord[]>([]);
  const [error, setError] = useState('');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [inviteStatus, setInviteStatus] = useState<Status>('idle');
  const [inviteForm, setInviteForm] = useState({ partyName: '', guestNames: '' });
  const [dashboardStatus, setDashboardStatus] = useState<LoadStatus>('idle');
  const [dashboard, setDashboard] = useState({
    invited: 0,
    invitations: 0,
    respondedInvitations: 0,
    weddingAttending: 0,
    welcomeAttending: 0,
    declinedWedding: 0,
    missingInvitations: 0,
  });

  const collectionLabel = useMemo(() => ({
    rsvps: 'RSVPs',
    invitations: 'Invitations',
    guestbook: 'Guestbook',
  })[activeCollection] ?? activeCollection, [activeCollection]);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setRows([]);
      setError('');
      if (!currentUser) {
        setHasAdminClaim(false);
        return;
      }
      const token = await getIdTokenResult(currentUser, true);
      setHasAdminClaim(token.claims.admin === true);
    });
  }, []);

  useEffect(() => {
    if (!db || !user || !hasAdminClaim) {
      setDashboardStatus('idle');
      return undefined;
    }

    setDashboardStatus('loading');
    let invitationDocs: GuestRecord[] | null = null;
    let rsvpDocs: RsvpRecord[] | null = null;

    const updateDashboard = () => {
      if (!invitationDocs || !rsvpDocs) return;
      const weddingAttending = rsvpDocs.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.wedding === 'yes').length;
      const welcomeAttending = rsvpDocs.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.welcomeEvent === 'yes').length;
      const declinedWedding = rsvpDocs.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.wedding === 'no').length;
      setDashboard({
        invited: invitationDocs.reduce((sum, document) => sum + (((document.guests ?? []) as unknown[]).length), 0),
        invitations: invitationDocs.length,
        respondedInvitations: rsvpDocs.length,
        weddingAttending,
        welcomeAttending,
        declinedWedding,
        missingInvitations: Math.max(0, invitationDocs.length - rsvpDocs.length),
      });
      setDashboardStatus('loaded');
    };

    const unsubscribeInvitations = onSnapshot(collection(db, 'invitations'), (snapshot) => {
      invitationDocs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      updateDashboard();
    }, (caught) => {
      setDashboardStatus('error');
      setError(caught.message);
    });

    const unsubscribeRsvps = onSnapshot(collection(db, 'rsvps'), (snapshot) => {
      rsvpDocs = snapshot.docs.map((document) => ({ id: document.id, ...document.data() } as RsvpRecord));
      updateDashboard();
    }, (caught) => {
      setDashboardStatus('error');
      setError(caught.message);
    });

    return () => {
      unsubscribeInvitations();
      unsubscribeRsvps();
    };
  }, [hasAdminClaim, user]);

  const load = async (collectionName: string) => {
    setActiveCollection(collectionName);
    setLoadStatus('loading');
    setError('');
    setRows([]);
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const snapshot = await getDocs(query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(50)));
      setRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoadStatus('loaded');
    } catch (caught) {
      setLoadStatus('error');
      setError(caught instanceof Error ? caught.message : 'Unable to load records.');
    }
  };

  const login = async () => {
    if (!auth) return setError('Firebase is not configured.');
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch (caught) {
      setError(authErrorMessage(caught));
    }
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteStatus('saving');
    setError('');
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const firestore = db;
      const guestNames = inviteForm.guestNames
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean);
      if (guestNames.length === 0) throw new Error('Add at least one guest name.');
      const invitationRef = doc(collection(firestore, 'invitations'));
      const guests = guestNames.map((name, index) => ({ id: `${index + 1}`, name }));
      const batch = writeBatch(firestore);
      batch.set(invitationRef, {
        partyName: inviteForm.partyName || guestNames.join(', '),
        guests,
        createdAt: serverTimestamp(),
      });
      for (const name of guestNames) {
        if (!isSearchableGuestName(name)) continue;
        const normalizedName = normalizeName(name);
        const partyName = inviteForm.partyName || guestNames.join(', ');
        const match = { invitationId: invitationRef.id, guestName: name, partyName };
        const lookupRef = doc(firestore, 'inviteLookups', normalizedName);
        const existingLookup = await getDoc(lookupRef);
        const existingMatches = existingLookup.exists() && Array.isArray(existingLookup.data().matches)
          ? existingLookup.data().matches as LookupMatch[]
          : [];
        const matches = uniqueMatches([...existingMatches, match]);

        batch.set(lookupRef, {
          invitationId: matches.length === 1 ? invitationRef.id : null,
          guestName: matches.length === 1 ? name : null,
          partyName: matches.length === 1 ? partyName : null,
          matches,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        searchKeysForName(name).forEach((searchKey) => {
          batch.set(doc(firestore, 'inviteNameSearch', `${searchKey}__${invitationRef.id}__${normalizedName}`), {
            invitationId: invitationRef.id,
            guestName: name,
            partyName,
            searchKey,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      setInviteForm({ partyName: '', guestNames: '' });
      setInviteStatus('saved');
    } catch (caught) {
      setInviteStatus('error');
      setError(caught instanceof Error ? caught.message : 'Unable to create invitation.');
    }
  };

  return (
    <>
      <PageHeader title="Admin" eyebrow="Private dashboard">
                <Typography variant="h6">Review RSVPs, invitations, and guestbook submissions.</Typography>
      </PageHeader>
      <Section title="Submissions">
        <Paper className="form-panel" sx={{ p: { xs: 2, md: 4 }, maxWidth: 1120, mx: 'auto' }}>
          <Stack spacing={2.5}>
            {firebaseMessage() && <Alert severity="info">{firebaseMessage()}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
            {!user ? (
              <Button variant="contained" startIcon={<LoginIcon />} onClick={login}>Sign in with Google</Button>
            ) : (
              <>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' } }}>
                  <Chip label={user.email} />
                  <Chip color={hasAdminClaim ? 'success' : 'warning'} label={hasAdminClaim ? 'Admin claim active' : 'Admin claim missing'} />
                  <Button startIcon={<LogoutIcon />} onClick={() => auth && signOut(auth)}>Sign out</Button>
                </Stack>
                {!hasAdminClaim ? (
                  <Alert severity="warning">
                    This account can sign in, but Firestore reads require the private Firebase Auth custom claim `admin: true`.
                    Run `npm run set-admins`, then sign out and back in.
                  </Alert>
                ) : (
                  <>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Stack spacing={2}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between' }}>
                          <Typography variant="h5">Dashboard</Typography>
                          <Chip color={dashboardStatus === 'error' ? 'error' : dashboardStatus === 'loaded' ? 'success' : 'default'} label={dashboardStatus === 'loaded' ? 'Live' : dashboardStatus === 'loading' ? 'Syncing' : 'Waiting'} />
                        </Stack>
                        <Grid container spacing={2}>
                          {[
                            ['Invited guests', dashboard.invited],
                            ['Invitation groups', dashboard.invitations],
                            ['Responded groups', dashboard.respondedInvitations],
                            ['Missing RSVPs', dashboard.missingInvitations],
                            ['Wedding attending', dashboard.weddingAttending],
                            ['Welcome attending', dashboard.welcomeAttending],
                            ['Wedding declined', dashboard.declinedWedding],
                          ].map(([label, value]) => (
                            <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}>
                              <Paper className="lift-card" sx={{ p: 2 }}>
                                <Typography variant="overline">{label}</Typography>
                                <Typography variant="h4">{value}</Typography>
                              </Paper>
                            </Grid>
                          ))}
                        </Grid>
                      </Stack>
                    </Paper>
                    <Paper component="form" variant="outlined" onSubmit={createInvitation} sx={{ p: 2.5 }}>
                      <Stack spacing={2}>
                        <Typography variant="h5">Create invitation group</Typography>
                        {inviteStatus === 'saved' && <Alert severity="success">Invitation group created.</Alert>}
                        {inviteStatus === 'error' && <Alert severity="error">Unable to create invitation group.</Alert>}
                        <TextField
                          fullWidth
                          label="Invitation name"
                          value={inviteForm.partyName}
                          onChange={(event) => setInviteForm({ ...inviteForm, partyName: event.target.value })}
                          helperText="Example: Smith Family or Jeff Smith"
                        />
                        <TextField
                          required
                          fullWidth
                          multiline
                          minRows={4}
                          label="Invited guests"
                          value={inviteForm.guestNames}
                          onChange={(event) => setInviteForm({ ...inviteForm, guestNames: event.target.value })}
                          helperText="One full guest name per line. Example: Jeff Smith, Maddie Smith, Anne Smith."
                        />
                        <Button type="submit" variant="contained" disabled={inviteStatus === 'saving'}>
                          {inviteStatus === 'saving' ? 'Creating' : 'Create invitation'}
                        </Button>
                      </Stack>
                    </Paper>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant={activeCollection === 'rsvps' ? 'contained' : 'outlined'} onClick={() => load('rsvps')}>Load RSVPs</Button>
                      <Button variant={activeCollection === 'invitations' ? 'contained' : 'outlined'} onClick={() => load('invitations')}>Load invitations</Button>
                      <Button variant={activeCollection === 'guestbook' ? 'contained' : 'outlined'} onClick={() => load('guestbook')}>Load guestbook</Button>
                    </Stack>
                    {loadStatus === 'loading' && <Alert severity="info">Loading {collectionLabel}...</Alert>}
                    {loadStatus === 'loaded' && rows.length === 0 && <Alert severity="info">No {collectionLabel} records found.</Alert>}
                    {rows.length > 0 && activeCollection === 'invitations' && <InvitationAdminTable rows={rows as InvitationAdminRecord[]} />}
                    {rows.length > 0 && activeCollection === 'rsvps' && <RsvpAdminTable rows={rows as RsvpRecord[]} />}
                    {rows.length > 0 && activeCollection === 'guestbook' && <GuestbookAdminTable rows={rows as GuestbookRecord[]} />}
                  </>
                )}
              </>
            )}
          </Stack>
        </Paper>
      </Section>
    </>
  );
}

function RsvpAdminTable({ rows }: { rows: RsvpRecord[] }) {
  const responseLabel = (response: RsvpResponse) => {
    const wedding = response.wedding === 'yes' ? 'Wedding yes' : 'Wedding no';
    const welcome = response.welcomeEvent === 'yes' ? 'Welcome yes' : 'Welcome no';
    return `${response.name} - ${wedding} / ${welcome}`;
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Invitation</TableCell>
            <TableCell>Contact</TableCell>
            <TableCell>Responses</TableCell>
            <TableCell>Totals</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => {
            const weddingYes = (row.responses ?? []).filter((response) => response.wedding === 'yes').length;
            const welcomeYes = (row.responses ?? []).filter((response) => response.welcomeEvent === 'yes').length;

            return (
              <TableRow key={row.id} hover sx={{ verticalAlign: 'top' }}>
                <TableCell sx={{ minWidth: 200 }}>
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 800 }}>{row.invitationName || row.id}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.invitationId || row.id}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  <Stack spacing={0.5}>
                    <Typography>{row.contactEmail}</Typography>
                    {row.contactPhone && <Typography color="text.secondary">{row.contactPhone}</Typography>}
                  </Stack>
                </TableCell>
                <TableCell sx={{ minWidth: 360 }}>
                  <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                    {(row.responses ?? []).map((response) => (
                      <Chip
                        key={`${row.id}-${response.name}`}
                        label={responseLabel(response)}
                        size="small"
                        color={response.wedding === 'yes' ? 'success' : 'default'}
                        variant={response.welcomeEvent === 'yes' ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell sx={{ minWidth: 150 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="caption">Wedding: {weddingYes}/{row.responses?.length ?? 0}</Typography>
                    <Typography variant="caption">Welcome: {welcomeYes}/{row.responses?.length ?? 0}</Typography>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function GuestbookAdminTable({ rows }: { rows: GuestbookRecord[] }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Message</TableCell>
            <TableCell>Record</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover sx={{ verticalAlign: 'top' }}>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography sx={{ fontWeight: 800 }}>{row.name}</Typography>
              </TableCell>
              <TableCell sx={{ minWidth: 420 }}>
                <Typography sx={{ whiteSpace: 'pre-wrap' }}>{row.message}</Typography>
              </TableCell>
              <TableCell sx={{ minWidth: 180 }}>
                <Typography variant="caption" color="text.secondary">{row.id}</Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function InvitationAdminTable({ rows }: { rows: InvitationAdminRecord[] }) {
  const formatAddress = (address: InvitationAdminRecord['address']) => {
    if (!address) return '';
    return [address.line1, address.line2, [address.city, address.state, address.zip].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join('\n');
  };

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 620 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Invitation</TableCell>
            <TableCell>Guests</TableCell>
            <TableCell>Address</TableCell>
            <TableCell>Counts</TableCell>
            <TableCell>Notes</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} hover sx={{ verticalAlign: 'top' }}>
              <TableCell sx={{ minWidth: 190 }}>
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 800 }}>{row.partyName || row.envelopeName || row.id}</Typography>
                  {row.envelopeName && row.envelopeName !== row.partyName && (
                    <Typography variant="caption" color="text.secondary">{row.envelopeName}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">{row.id}</Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ minWidth: 260 }}>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', rowGap: 0.75 }}>
                  {(row.guests ?? []).map((guest) => (
                    <Chip key={`${row.id}-${guest.id}`} label={guest.name} size="small" />
                  ))}
                </Stack>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'pre-line', minWidth: 220 }}>
                {formatAddress(row.address)}
              </TableCell>
              <TableCell sx={{ minWidth: 150 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption">Guests: {row.guests?.length ?? 0}</Typography>
                  <Typography variant="caption">Kids: {row.counts?.kids ?? '-'}</Typography>
                  <Typography variant="caption">Plus ones: {row.counts?.potentialPlusOnes ?? '-'}</Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ minWidth: 220 }}>{row.notes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function Footer() {
  return (
    <Box className="site-footer" component="footer" sx={{ py: 5, color: 'white' }}>
      <Container>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Typography>{wedding.couple} - {wedding.date}</Typography>
          <Typography>More details coming soon</Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;
