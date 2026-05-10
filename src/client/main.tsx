import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.tsx';
import { ThemeProvider } from '@/client/components/theme-provider.tsx';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element not found');
}
createRoot(rootEl).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
