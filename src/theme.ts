import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2f5d50' },
    secondary: { main: '#b46a55' },
    background: { default: '#fbfaf7', paper: '#ffffff' },
    text: { primary: '#202522', secondary: '#5f6761' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
    h1: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600, letterSpacing: 0 },
    h2: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600, letterSpacing: 0 },
    h3: { fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700, letterSpacing: 0 },
  },
});
