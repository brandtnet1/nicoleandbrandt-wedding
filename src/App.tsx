import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
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
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, db, firebaseEnabled, googleProvider } from './lib/firebase';
import { wedding } from './content/wedding';

type Status = 'idle' | 'saving' | 'saved' | 'error';
type GuestRecord = Record<string, unknown> & { id: string };

const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

const sections = ['Details', 'RSVP', 'Save Date', 'Registry', 'Travel', 'Guestbook', 'Admin'];

const sectionId = (section: string) => section.toLowerCase().replace(/\s+/g, '-');

function firebaseMessage() {
  return firebaseEnabled
    ? null
    : 'Firebase is not configured yet. Add your VITE_FIREBASE_* values to .env.local to enable live submissions.';
}

async function save(collectionName: string, payload: Record<string, unknown>) {
  if (!db) throw new Error('Firebase is not configured.');
  await addDoc(collection(db, collectionName), { ...payload, createdAt: serverTimestamp() });
}

function App() {
  const [mobileAnchor, setMobileAnchor] = useState<null | HTMLElement>(null);
  const [activeTab, setActiveTab] = useState(0);

  const scrollTo = (id: string) => {
    document.getElementById(sectionId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileAnchor(null);
  };

  useEffect(() => {
    const onScroll = () => {
      const current = sections.findLast((section) => {
        const top = document.getElementById(sectionId(section))?.getBoundingClientRect().top ?? 9999;
        return top <= 120;
      });
      if (current) setActiveTab(sections.indexOf(current));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Box>
      <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: '1px solid #e4e0d8' }}>
        <Toolbar sx={{ gap: 2 }}>
          <FavoriteIcon color="secondary" />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800 }}>
            {wedding.couple}
          </Typography>
          <Tabs
            value={activeTab}
            onChange={(_, value) => scrollTo(sections[value])}
            sx={{ display: { xs: 'none', md: 'block' } }}
          >
            {sections.map((section) => (
              <Tab key={section} label={section} />
            ))}
          </Tabs>
          <Tooltip title="Navigation">
            <IconButton onClick={(event) => setMobileAnchor(event.currentTarget)} sx={{ display: { md: 'none' } }}>
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={mobileAnchor} open={Boolean(mobileAnchor)} onClose={() => setMobileAnchor(null)}>
            {sections.map((section) => (
              <MenuItem key={section} onClick={() => scrollTo(section)}>
                {section}
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </AppBar>

      <Hero />
      <Details />
      <Rsvp />
      <SaveTheDate />
      <Registry />
      <Travel />
      <Guestbook />
      <Admin />
      <Footer />
    </Box>
  );
}

function Hero() {
  return (
    <Box
      component="header"
      sx={{
        minHeight: { xs: '86svh', md: '88svh' },
        display: 'flex',
        alignItems: 'end',
        color: 'white',
        background:
          'linear-gradient(180deg, rgba(22,32,28,.16), rgba(22,32,28,.72)), url(https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1800&q=80)',
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <Container sx={{ pb: { xs: 8, md: 10 } }}>
        <Stack spacing={2} sx={{ maxWidth: 760 }}>
          <Chip label={wedding.date} color="secondary" sx={{ alignSelf: 'start', bgcolor: '#fff', color: '#2f5d50' }} />
          <Typography variant="h1" sx={{ fontSize: { xs: 58, md: 96 }, lineHeight: 0.95 }}>
            {wedding.couple}
          </Typography>
          <Typography variant="h5" sx={{ maxWidth: 620 }}>
            {wedding.venue} in {wedding.city}. Ceremony at {wedding.ceremonyTime}.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="contained" size="large" endIcon={<SendIcon />} onClick={() => document.getElementById('rsvp')?.scrollIntoView({ behavior: 'smooth' })}>
              RSVP
            </Button>
            <Button variant="outlined" size="large" sx={{ color: 'white', borderColor: 'white' }} onClick={() => document.getElementById('details')?.scrollIntoView({ behavior: 'smooth' })}>
              Event details
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <Box id={id} component="section" sx={{ py: { xs: 7, md: 10 }, scrollMarginTop: 88 }}>
      <Container>
        <Typography variant="h2" sx={{ mb: 4, fontSize: { xs: 42, md: 58 } }}>
          {title}
        </Typography>
        {children}
      </Container>
    </Box>
  );
}

function Details() {
  return (
    <Section id="details" title="Wedding Details">
      <Grid container spacing={3}>
        {[
          ['When', `${wedding.date}, ${wedding.ceremonyTime}`],
          ['Where', `${wedding.venue}, ${wedding.venueAddress}`],
          ['RSVP By', wedding.rsvpDeadline],
        ].map(([label, value]) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="overline">{label}</Typography>
              <Typography variant="h5">{value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <List sx={{ mt: 4 }}>
        {wedding.schedule.map((item) => (
          <ListItem key={item.time} divider>
            <ListItemText primary={`${item.time} - ${item.title}`} secondary={item.detail} />
          </ListItem>
        ))}
      </List>
    </Section>
  );
}

function Rsvp() {
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
    <Section id="rsvp" title="RSVP">
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 820 }}>
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
    </Section>
  );
}

function Registry() {
  return (
    <Section id="registry" title="Registry">
      <Grid container spacing={3}>
        {wedding.registry.map((item) => (
          <Grid key={item.name} size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Stack spacing={2}>
                <CelebrationIcon color="secondary" />
                <Typography variant="h5">{item.name}</Typography>
                <Typography color="text.secondary">{item.description}</Typography>
                <Button component={Link} href={item.url} target="_blank" rel="noreferrer" variant="outlined" endIcon={<OpenInNewIcon />}>
                  Open registry
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Section>
  );
}

function SaveTheDate() {
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({ name: '', email: '', phone: '', mailingAddress: '' });
  const message = firebaseMessage();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    try {
      await save('saveTheDates', form);
      setStatus('saved');
      setForm({ name: '', email: '', phone: '', mailingAddress: '' });
    } catch {
      setStatus('error');
    }
  };

  return (
    <Section id="save-date" title="Save The Date">
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 820 }}>
        <Stack spacing={2}>
          {message && <Alert severity="info">{message}</Alert>}
          {status === 'saved' && <Alert severity="success">Contact details saved.</Alert>}
          {status === 'error' && <Alert severity="error">Unable to submit right now.</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField required fullWidth type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Grid>
            <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Mailing address" value={form.mailingAddress} onChange={(e) => setForm({ ...form, mailingAddress: e.target.value })} /></Grid>
          </Grid>
          <Button type="submit" variant="contained" disabled={status === 'saving'} endIcon={<SendIcon />}>Save contact info</Button>
        </Stack>
      </Paper>
    </Section>
  );
}

function Travel() {
  return (
    <Section id="travel" title="Travel">
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <FlightIcon color="primary" />
            <Typography variant="h5" sx={{ mt: 1 }}>Getting there</Typography>
            <Typography color="text.secondary">Fly into ATL. The venue is about 25 minutes from the airport outside peak traffic.</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <RestaurantIcon color="primary" />
            <Typography variant="h5" sx={{ mt: 1 }}>Weekend plans</Typography>
            <Typography color="text.secondary">Welcome drinks, hotel blocks, and shuttle timing can be published here as soon as details are final.</Typography>
          </Paper>
        </Grid>
      </Grid>
      <Stack spacing={2} sx={{ mt: 4 }}>
        {wedding.faqs.map((faq) => (
          <Paper key={faq.q} sx={{ p: 3 }}>
            <Typography variant="h6">{faq.q}</Typography>
            <Typography color="text.secondary">{faq.a}</Typography>
          </Paper>
        ))}
      </Stack>
    </Section>
  );
}

function Guestbook() {
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
    <Section id="guestbook" title="Guestbook">
      <Paper component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 4 }, maxWidth: 820 }}>
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
  );
}

function Admin() {
  const [user, setUser] = useState<User | null>(null);
  const [rows, setRows] = useState<GuestRecord[]>([]);
  const [error, setError] = useState('');
  const isAdmin = useMemo(() => Boolean(user?.email && adminEmails.includes(user.email.toLowerCase())), [user]);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, setUser);
  }, []);

  const load = async (collectionName: string) => {
    if (!db) return;
    const snapshot = await getDocs(query(collection(db, collectionName), orderBy('createdAt', 'desc'), limit(25)));
    setRows(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const login = async () => {
    if (!auth) return setError('Firebase is not configured.');
    try {
      setError('');
      await signInWithPopup(auth, googleProvider);
    } catch {
      setError('Google sign-in failed.');
    }
  };

  return (
    <Section id="admin" title="Admin">
      <Paper sx={{ p: { xs: 2, md: 4 } }}>
        <Stack spacing={2}>
          {firebaseMessage() && <Alert severity="info">{firebaseMessage()}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
          {!user ? (
            <Button variant="contained" startIcon={<LoginIcon />} onClick={login}>Sign in with Google</Button>
          ) : (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Chip label={user.email} />
                <Button startIcon={<LogoutIcon />} onClick={() => auth && signOut(auth)}>Sign out</Button>
              </Stack>
              {!isAdmin ? (
                <Alert severity="warning">Your email is not in VITE_ADMIN_EMAILS.</Alert>
              ) : (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <Button variant="outlined" onClick={() => load('rsvps')}>Load RSVPs</Button>
                  <Button variant="outlined" onClick={() => load('guestbook')}>Load guestbook</Button>
                  <Button variant="outlined" onClick={() => load('saveTheDates')}>Load save-the-dates</Button>
                </Stack>
              )}
              {rows.map((row) => (
                <Paper key={row.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 14 }}>
                    {JSON.stringify(row, null, 2)}
                  </Typography>
                </Paper>
              ))}
            </>
          )}
        </Stack>
      </Paper>
    </Section>
  );
}

function Footer() {
  return (
    <Box component="footer" sx={{ py: 5, bgcolor: '#25352f', color: 'white' }}>
      <Container>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between' }}>
          <Typography>{wedding.couple} - {wedding.date}</Typography>
          <Typography>{wedding.email}</Typography>
        </Stack>
      </Container>
    </Box>
  );
}

export default App;
