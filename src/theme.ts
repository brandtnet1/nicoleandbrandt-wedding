import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#6f321f' },
    secondary: { main: '#b5793b' },
    background: { default: '#fbf7ef', paper: '#fffdf8' },
    text: { primary: '#2d2924', secondary: '#70675d' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h1: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, letterSpacing: 0 },
    h2: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, letterSpacing: 0 },
    h3: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 700, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
  },
});
