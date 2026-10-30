import { execFileSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Version affichée sur l'accueil : le commit compilé, pour vérifier ce qui est en ligne. */
function appVersion(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// En développement, Vite relaie Socket.IO vers le serveur de jeu (port 3000).
// `host: true` rend le site accessible aux téléphones du même réseau Wi-Fi.
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  plugins: [
    react(),
    tailwindcss(),
    // Service worker (production uniquement) : rend l'application installable partout
    // et garde en cache le code et les illustrations pour des démarrages rapides.
    VitePWA({
      // Le manifeste existe déjà dans public/ ; on ne le régénère pas.
      manifest: false,
      // Pas de rechargement forcé en pleine partie : la nouvelle version s'active en silence.
      registerType: 'prompt',
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,svg,png,webp,woff2}'],
        // La page elle-même vient toujours du réseau quand il est là : une mise à jour du jeu
        // est donc prise en compte dès le rechargement suivant.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
