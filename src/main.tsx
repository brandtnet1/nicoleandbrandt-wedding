import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { ReactLenis } from 'lenis/react';
import App from './App';
import { theme } from './theme';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <ReactLenis root>
          <App />
        </ReactLenis>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
