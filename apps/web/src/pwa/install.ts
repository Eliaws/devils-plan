// Installation de l'application web (PWA) : ce que le bouton « Installer » doit proposer.
// - Android / Chrome / Edge : le navigateur fournit une invite qu'on déclenche nous-mêmes ;
// - iPhone / iPad : aucune invite possible, on affiche les deux gestes à faire dans Safari ;
// - déjà installée (ouverte en plein écran) ou navigateur sans support : on n'affiche rien.

import { useSyncExternalStore } from 'react';

/** Événement non standard de Chromium, absent des types du DOM. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallMode = 'prompt' | 'ios' | 'installed' | 'unavailable';

/** Plateforme Apple mobile : iPhone, iPod, ou iPad (qui se présente comme un Mac tactile). */
export function isAppleMobile(userAgent: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function installMode(options: { standalone: boolean; hasPrompt: boolean; appleMobile: boolean }): InstallMode {
  if (options.standalone) return 'installed';
  if (options.hasPrompt) return 'prompt';
  if (options.appleMobile) return 'ios';
  return 'unavailable';
}

// --- État partagé, alimenté dès le chargement de la page ---------------------
// L'invite Chromium n'est envoyée qu'une fois, souvent avant l'affichage de React :
// on l'écoute dès l'import de ce module.

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installed || iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

function currentMode(): InstallMode {
  return installMode({
    standalone: isStandalone(),
    hasPrompt: deferredPrompt !== null,
    appleMobile: isAppleMobile(navigator.userAgent, navigator.maxTouchPoints),
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, currentMode, () => 'unavailable');
}

/** Ouvre l'invite d'installation du navigateur (Android, Chrome, Edge). Renvoie vrai si acceptée. */
export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt;
  if (!prompt) return false;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  return outcome === 'accepted';
}
