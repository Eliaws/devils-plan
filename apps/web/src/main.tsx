import { registerSW } from 'virtual:pwa-register';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './app.css';
import { watchForNewVersion } from './pwa/freshness.ts';
import './pwa/install.ts';

// Service worker (production) : installation de l'application et démarrages rapides.
registerSW({ immediate: true });
// Après une mise en ligne, recharge les téléphones restés sur l'ancien site.
if (import.meta.env.PROD) watchForNewVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
