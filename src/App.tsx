import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Link as MuiLink,
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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CelebrationIcon from '@mui/icons-material/Celebration';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FlightIcon from '@mui/icons-material/Flight';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SendIcon from '@mui/icons-material/Send';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'RSVP', path: '/rsvp' },
  { label: 'Registry', path: '/registry' },
  { label: 'Guestbook', path: '/guestbook' },
];

function firebaseMessage() {
  return firebaseEnabled
    ? null
    : 'Firebase is not configured yet. Add your VITE_FIREBASE_* values to .env.local to enable live submissions.';
}

async function save(collectionName: string, payload: Record<string, unknown>) {
  if (!db) throw new Error('Firebase is not configured.');
  await addDoc(collection(db, collectionName), { ...payload, createdAt: serverTimestamp() });
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
    <Box>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/rsvp" element={<RsvpPage />} />
        <Route path="/registry" element={<RegistryPage />} />
        <Route path="/guestbook" element={<GuestbookPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <Footer />
    </Box>
  );
}

function Nav() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const location = useLocation();

  return (
    <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: '1px solid #e5ded2' }}>
      <Toolbar sx={{ gap: 2 }}>
        <AutoAwesomeIcon color="secondary" />
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
      <Section title="Weekend Preview" tone="cream">
        <Paper sx={{ maxWidth: 860, mx: 'auto', overflow: 'hidden' }}>
          {wedding.schedule.map((item, index) => (
            <Box
              key={item.title}
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
      sx={{
        minHeight: { xs: '78svh', md: '84svh' },
        display: 'flex',
        alignItems: 'end',
        color: 'white',
        background:
          'linear-gradient(180deg, rgba(34, 27, 21, .16), rgba(34, 27, 21, .78)), url(https://images.unsplash.com/photo-1507048331197-7d4ac70811cf?auto=format&fit=crop&w=1800&q=80)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <Container sx={{ pb: { xs: 7, md: 9 } }}>
        <Stack spacing={2.5} sx={{ maxWidth: 760 }}>
          <Chip label={wedding.date} sx={{ alignSelf: 'start', bgcolor: '#fff8ed', color: '#6f321f', fontWeight: 800 }} />
          <Typography variant="h1" sx={{ fontSize: { xs: 56, md: 104 }, lineHeight: 0.92 }}>
            {wedding.couple}
          </Typography>
          <Typography variant="h5" sx={{ maxWidth: 660 }}>
            A fall wedding at {wedding.venue} in {wedding.city}.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button component={RouterLink} to="/rsvp" variant="contained" size="large" endIcon={<SendIcon />}>RSVP</Button>
            <Button component={RouterLink} to="/registry" variant="outlined" size="large" sx={{ color: 'white', borderColor: 'white' }}>Registry</Button>
            <Button component={RouterLink} to="/guestbook" variant="outlined" size="large" sx={{ color: 'white', borderColor: 'white' }}>Guestbook</Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'cream' }) {
  return (
    <Box component="section" sx={{ py: { xs: 7, md: 10 }, bgcolor: tone === 'cream' ? '#f5efe4' : 'transparent' }}>
      <Container>
        <Typography variant="h2" sx={{ mb: 4, fontSize: { xs: 40, md: 58 } }}>
          {title}
        </Typography>
        {children}
      </Container>
    </Box>
  );
}

function PageHeader({ title, eyebrow, children }: { title: string; eyebrow: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ py: { xs: 7, md: 9 }, bgcolor: '#30261f', color: 'white' }}>
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
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="overline" color="secondary">{label}</Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
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
  const [form, setForm] = useState({ name: '', email: '', attending: 'yes', partySize: '1', meal: '', notes: '' });
  const message = firebaseMessage();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    try {
      await save('rsvps', { ...form, partySize: Number(form.partySize) });
      setStatus('saved');
      setForm({ name: '', email: '', attending: 'yes', partySize: '1', meal: '', notes: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 860, mx: 'auto' }}>
      <Stack spacing={2}>
        {message && <Alert severity="info">{message}</Alert>}
        {status === 'saved' && <Alert severity="success">RSVP received.</Alert>}
        {status === 'error' && <Alert severity="error">Unable to submit right now. Check Firebase configuration.</Alert>}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField select fullWidth label="Attending" value={form.attending} onChange={(e) => setForm({ ...form, attending: e.target.value })}><MenuItem value="yes">Yes</MenuItem><MenuItem value="no">No</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth type="number" label="Party size" slotProps={{ htmlInput: { min: 1, max: 8 } }} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: e.target.value })} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Meal preference" value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value })} /></Grid>
          <Grid size={12}><TextField fullWidth multiline minRows={3} label="Dietary needs or notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Grid>
        </Grid>
        <Button type="submit" variant="contained" size="large" disabled={status === 'saving'} endIcon={<SendIcon />}>
          {status === 'saving' ? 'Submitting' : 'Submit RSVP'}
        </Button>
      </Stack>
    </Paper>
  );
}

function RegistryPage() {
  return (
    <>
      <PageHeader title="Registry" eyebrow="Thank you">
        <Typography variant="h6">Your presence is the gift. For anyone who has asked, our registries are linked below.</Typography>
      </PageHeader>
      <Section title="Gift Registries">
        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {wedding.registry.map((item) => (
            <Grid key={item.name} size={{ xs: 12, md: 4 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Stack spacing={2}>
                  <CelebrationIcon color="secondary" />
                  <Typography variant="h5">{item.name}</Typography>
                  <Typography color="text.secondary">{item.description}</Typography>
                  <Button component={MuiLink} href={item.url} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewIcon />}>
                    Open registry
                  </Button>
                </Stack>
              </Paper>
            </Grid>
          ))}
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
        <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 820, mx: 'auto' }}>
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

  const collectionLabel = useMemo(() => ({
    rsvps: 'RSVPs',
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

  return (
    <>
      <PageHeader title="Admin" eyebrow="Private dashboard">
        <Typography variant="h6">Review RSVP and guestbook submissions.</Typography>
      </PageHeader>
      <Section title="Submissions">
        <Paper sx={{ p: { xs: 2, md: 4 }, maxWidth: 1120, mx: 'auto' }}>
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
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <Button variant={activeCollection === 'rsvps' ? 'contained' : 'outlined'} onClick={() => load('rsvps')}>Load RSVPs</Button>
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
                <TableCell key={column}>{String(row[column] ?? '')}</TableCell>
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
    <Box component="footer" sx={{ py: 5, bgcolor: '#30261f', color: 'white' }}>
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
