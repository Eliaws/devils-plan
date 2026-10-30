// Garde les téléphones à jour : après une mise en ligne, un téléphone peut continuer
// à exécuter l'ancien site (cache du navigateur ou du service worker). On compare la
// version compilée avec celle du serveur, et on recharge une fois si elles diffèrent.

const RELOADED_KEY = 'umbra-reloaded-for';

/** Recharger seulement si les versions sont connues, différentes, et pas déjà tenté pour celle-ci. */
export function shouldReload(client: string, server: string | null, alreadyTriedFor: string | null): boolean {
  if (!server || server === 'inconnue') return false;
  return server !== client && alreadyTriedFor !== server;
}

async function check(): Promise<void> {
  let server: string | null = null;
  try {
    const response = await fetch('/version', { cache: 'no-store' });
    if (response.ok) server = ((await response.json()) as { version?: string }).version ?? null;
  } catch {
    return;
  }
  if (!shouldReload(__APP_VERSION__, server, sessionStorage.getItem(RELOADED_KEY)) || !server) return;
  sessionStorage.setItem(RELOADED_KEY, server);
  // Le nouveau service worker s'active tout de suite (skipWaiting), puis on recharge la page.
  const registration = await navigator.serviceWorker?.getRegistration();
  await registration?.update().catch(() => {});
  location.reload();
}

/** Vérifie au démarrage, puis à chaque retour sur l'application (téléphone sorti de veille). */
export function watchForNewVersion(): void {
  void check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
