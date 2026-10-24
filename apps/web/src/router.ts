// Routeur minimal (3 écrans) basé sur l'API History : pas besoin d'une bibliothèque.

import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home'; code?: string }
  | { name: 'play'; code: string }
  | { name: 'table'; code: string }
  | { name: 'notFound' };

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(path: string, options: { replace?: boolean } = {}) {
  if (options.replace) history.replaceState(null, '', path);
  else history.pushState(null, '', path);
  for (const listener of listeners) listener();
}

export function parseRoute(pathname: string, search = ''): Route {
  const [, first, code] = pathname.split('/');
  const normalized = code?.toUpperCase();
  if (!first) {
    const join = new URLSearchParams(search).get('code')?.toUpperCase();
    return join ? { name: 'home', code: join } : { name: 'home' };
  }
  if (first === 'p' && normalized) return { name: 'play', code: normalized };
  if (first === 't' && normalized) return { name: 'table', code: normalized };
  return { name: 'notFound' };
}

export function useRoute(): Route {
  const location = useSyncExternalStore(subscribe, () => window.location.pathname + window.location.search);
  const url = new URL(location, window.location.origin);
  return parseRoute(url.pathname, url.search);
}

export const paths = {
  home: () => '/',
  play: (code: string) => `/p/${code}`,
  table: (code: string) => `/t/${code}`,
  /** Lien d'invitation : ouvre l'accueil avec le code prérempli. */
  invite: (code: string) => `${window.location.origin}/?code=${code}`,
};
