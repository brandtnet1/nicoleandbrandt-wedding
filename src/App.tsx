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
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { Link as RouterLink, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { auth, db, firebaseEnabled, googleProvider } from './lib/firebase';
import { wedding } from './content/wedding';

type Status = 'idle' | 'saving' | 'saved' | 'error';
type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error';
type GuestRecord = Record<string, unknown> & { id: string };
type InvitationGuest = { id: string; name: string };
type Invitation = {
  id: string;
  partyName: string;
  guests: InvitationGuest[];
};
type Attendance = 'yes' | 'no';
type RsvpResponse = { name: string; wedding: Attendance; welcomeEvent: Attendance; meal: string };
type GuestResponse = Record<string, RsvpResponse>;
type RsvpRecord = {
  id: string;
  invitationId: string;
  invitationName: string;
  contactEmail: string;
  contactPhone?: string;
  responses: RsvpResponse[];
  notes?: string;
};

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'RSVP', path: '/rsvp' },
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
  return (
    <Box className="app-shell">
      <Nav />
      <Box component="main" className="page-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/rsvp" element={<RsvpPage />} />
          <Route path="/travel" element={<TravelPage />} />
          <Route path="/registry" element={<RegistryPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Box>
      <Footer />
    </Box>
  );
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
          ].map(([label, value]) => (
            <Grid key={label} size={{ xs: 12, md: 4 }}>
              <InfoCard label={label} value={value} />
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
            <Box
              key={item.title}
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
          ))}
        </Paper>
      </Section>
      <Section title="Travel & FAQ">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <FlightIcon color="primary" />
              <Typography variant="h5" sx={{ mt: 1 }}>Getting there</Typography>
              <Typography color="text.secondary">Fly into ATL. The venue is north of Atlanta in Woodstock, so guests should plan for extra travel time from the airport, especially with holiday weekend traffic.</Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <RestaurantIcon color="primary" />
              <Typography variant="h5" sx={{ mt: 1 }}>Weekend plans</Typography>
              <Typography color="text.secondary">Hotel blocks, transportation, and welcome details will be added as plans are finalized.</Typography>
            </Paper>
          </Grid>
          {wedding.faqs.map((faq) => (
            <Grid key={faq.q} size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6">{faq.q}</Typography>
                <Typography color="text.secondary">{faq.a}</Typography>
              </Paper>
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
            <Button className="magnetic-button" component={RouterLink} to="/rsvp" variant="contained" size="large" endIcon={<SendIcon />}>RSVP</Button>
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
        <Typography className="section-title" variant="h2" sx={{ mb: 4, fontSize: { xs: 40, md: 58 } }}>
          {title}
        </Typography>
        {children}
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
      ].map(([label, value]) => (
        <Paper className="countdown-tile" key={label}>
          <Typography variant="h2">{String(value).padStart(2, '0')}</Typography>
          <Typography variant="overline">{label}</Typography>
        </Paper>
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
  const [status, setStatus] = useState<Status>('idle');
  const [searchStatus, setSearchStatus] = useState<LoadStatus>('idle');
  const [searchName, setSearchName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [responses, setResponses] = useState<GuestResponse>({});
  const [existingRsvpId, setExistingRsvpId] = useState('');
  const message = firebaseMessage();

  const loadInvitation = async (invitationId: string) => {
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
      const rsvpData = rsvpDoc.data() as RsvpRecord;
      setExistingRsvpId(rsvpDoc.id);
      setEmail(rsvpData.contactEmail ?? '');
      setPhone(rsvpData.contactPhone ?? '');
      setNotes(rsvpData.notes ?? '');
      setResponses(Object.fromEntries(nextInvitation.guests.map((guest) => {
        const existing = rsvpData.responses?.find((response) => response.name === guest.name);
        return [
          guest.id,
          existing ?? { name: guest.name, wedding: 'yes', welcomeEvent: 'yes', meal: '' },
        ];
      })));
    } else {
      setExistingRsvpId('');
      setEmail('');
      setPhone('');
      setNotes('');
      setResponses(Object.fromEntries(nextInvitation.guests.map((guest) => [
        guest.id,
        { name: guest.name, wedding: 'yes', welcomeEvent: 'yes', meal: '' },
      ])));
    }
    setSearchStatus('loaded');
  };

  const searchByName = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchStatus('loading');
    setStatus('idle');
    setInvitation(null);
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const lookup = await getDoc(doc(db, 'inviteLookups', normalizeName(searchName)));
      if (!lookup.exists()) {
        setSearchStatus('loaded');
        return;
      }
      await loadInvitation(String(lookup.data().invitationId));
    } catch {
      setSearchStatus('error');
    }
  };

  const searchByEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearchStatus('loading');
    setStatus('idle');
    setInvitation(null);
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const lookup = await getDoc(doc(db, 'rsvpEmailLookups', normalizeEmail(editEmail)));
      if (!lookup.exists()) {
        setSearchStatus('loaded');
        return;
      }
      await loadInvitation(String(lookup.data().invitationId));
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
        notes,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });
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

  return (
    <Paper className="form-panel" sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>
      <Stack spacing={2}>
        {message && <Alert severity="info">{message}</Alert>}
        <Box component="form" onSubmit={searchByName}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField required fullWidth label="Search a name on your invitation" value={searchName} onChange={(event) => setSearchName(event.target.value)} />
            <Button type="submit" variant="contained" disabled={searchStatus === 'loading'} sx={{ minWidth: 150 }}>
              {searchStatus === 'loading' ? 'Searching' : 'Find Invitation'}
            </Button>
          </Stack>
        </Box>
        <Box component="form" onSubmit={searchByEmail}>
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">Already RSVP'd?</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField required fullWidth type="email" label="Edit using RSVP contact email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
              <Button type="submit" variant="outlined" disabled={searchStatus === 'loading'} sx={{ minWidth: 150 }}>
                Edit RSVP
              </Button>
            </Stack>
          </Stack>
        </Box>
        {searchStatus === 'loaded' && !invitation && <Alert severity="warning">No invitation found. For a first RSVP, search a name from the invitation. To edit, use the email submitted with the RSVP.</Alert>}
        {searchStatus === 'error' && <Alert severity="error">Unable to search invitations right now.</Alert>}
        {status === 'saved' && <Alert severity="success">RSVP received.</Alert>}
        {status === 'error' && <Alert severity="error">Unable to submit right now. Check Firebase configuration.</Alert>}
        {invitation && (
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <Alert severity="info">
                Invitation found for {invitation.partyName}. {existingRsvpId ? 'Existing RSVP loaded. You can update it below.' : 'Please respond for each guest below.'}
              </Alert>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField required fullWidth type="email" label="Contact email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Phone for text updates" value={phone} onChange={(event) => setPhone(event.target.value)} />
                </Grid>
              </Grid>
              {invitation.guests.map((guest) => (
                <Paper key={guest.id} variant="outlined" sx={{ p: 2 }}>
                  <Grid container spacing={2} sx={{ alignItems: 'center' }}>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <Typography variant="h6">{guest.name}</Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        select
                        fullWidth
                        label="Wedding"
                        value={responses[guest.id]?.wedding ?? 'yes'}
                        onChange={(event) => setResponses({
                          ...responses,
                          [guest.id]: { ...responses[guest.id], name: guest.name, wedding: event.target.value as Attendance },
                        })}
                      >
                        <MenuItem value="yes">Attending</MenuItem>
                        <MenuItem value="no">Not attending</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        select
                        fullWidth
                        label="Welcome event"
                        value={responses[guest.id]?.welcomeEvent ?? 'yes'}
                        onChange={(event) => setResponses({
                          ...responses,
                          [guest.id]: { ...responses[guest.id], name: guest.name, welcomeEvent: event.target.value as Attendance },
                        })}
                      >
                        <MenuItem value="yes">Attending</MenuItem>
                        <MenuItem value="no">Not attending</MenuItem>
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                      <TextField
                        fullWidth
                        label="Meal preference"
                        value={responses[guest.id]?.meal ?? ''}
                        onChange={(event) => setResponses({
                          ...responses,
                          [guest.id]: { ...responses[guest.id], name: guest.name, meal: event.target.value },
                        })}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              <TextField fullWidth multiline minRows={3} label="Dietary needs or notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
              <Button type="submit" variant="contained" size="large" disabled={status === 'saving'} endIcon={<SendIcon />}>
                {status === 'saving' ? 'Submitting' : 'Submit RSVP'}
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
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper className="form-panel" sx={{ p: { xs: 3, md: 4 }, height: '100%' }}>
              <Stack spacing={2}>
                <FlightIcon color="primary" />
                <Typography variant="h5">Airport</Typography>
                <Typography color="text.secondary">Hartsfield-Jackson Atlanta International Airport is the main airport for out-of-town guests. Woodstock is north of Atlanta, so check drive times before leaving.</Typography>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper className="form-panel" sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={2}>
                <RestaurantIcon color="primary" />
                <Typography variant="h5">Hotels & Transportation</Typography>
                <Typography color="text.secondary">Hotel blocks, shuttle details, and welcome-event travel notes will be added here once finalized.</Typography>
              </Stack>
            </Paper>
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

  const loadDashboard = async () => {
    setDashboardStatus('loading');
    setError('');
    try {
      if (!db) throw new Error('Firebase is not configured.');
      const [invitationSnapshot, rsvpSnapshot] = await Promise.all([
        getDocs(collection(db, 'invitations')),
        getDocs(collection(db, 'rsvps')),
      ]);
      const rsvps = rsvpSnapshot.docs.map((document) => document.data() as RsvpRecord);
      const weddingAttending = rsvps.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.wedding === 'yes').length;
      const welcomeAttending = rsvps.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.welcomeEvent === 'yes').length;
      const declinedWedding = rsvps.flatMap((rsvp) => rsvp.responses ?? []).filter((response) => response.wedding === 'no').length;
      setDashboard({
        invited: invitationSnapshot.docs.reduce((sum, document) => sum + (((document.data().guests ?? []) as unknown[]).length), 0),
        invitations: invitationSnapshot.size,
        respondedInvitations: rsvpSnapshot.size,
        weddingAttending,
        welcomeAttending,
        declinedWedding,
        missingInvitations: Math.max(0, invitationSnapshot.size - rsvpSnapshot.size),
      });
      setDashboardStatus('loaded');
    } catch (caught) {
      setDashboardStatus('error');
      setError(caught instanceof Error ? caught.message : 'Unable to load dashboard.');
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
      guestNames.forEach((name) => {
        batch.set(doc(firestore, 'inviteLookups', normalizeName(name)), {
          invitationId: invitationRef.id,
          guestName: name,
          partyName: inviteForm.partyName || guestNames.join(', '),
          createdAt: serverTimestamp(),
        });
      });
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
                          <Button variant="outlined" onClick={loadDashboard} disabled={dashboardStatus === 'loading'}>
                            {dashboardStatus === 'loading' ? 'Loading' : 'Refresh dashboard'}
                          </Button>
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
                    {rows.length > 0 && <AdminTable rows={rows} />}
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

function AdminTable({ rows }: { rows: GuestRecord[] }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).filter((key) => key !== 'createdAt');
  const formatCell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => <TableCell key={column}>{column}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              {columns.map((column) => (
                <TableCell key={column}>{formatCell(row[column])}</TableCell>
              ))}
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
