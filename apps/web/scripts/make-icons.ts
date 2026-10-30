// Génère les icônes de l'application installable (PWA) à partir du logo éclipse.
// Usage : npm run icons -w @umbra/web

import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

/** Éclipse dorée sur fond d'ombre ; `padding` laisse une marge pour les icônes « maskable ». */
function icon(padding: number): string {
  const r = 160 * (1 - padding);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#2a1d45"/><stop offset="100%" stop-color="#08080c"/>
    </radialGradient>
    <radialGradient id="corona" cx="50%" cy="50%" r="50%">
      <stop offset="55%" stop-color="#e3ac52" stop-opacity="0.55"/><stop offset="100%" stop-color="#e3ac52" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f6dca3"/><stop offset="100%" stop-color="#c98a35"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="${r * 1.55}" fill="url(#corona)"/>
  <circle cx="256" cy="256" r="${r}" fill="url(#sun)"/>
  <circle cx="${256 + r * 0.26}" cy="${256 - r * 0.16}" r="${r * 0.95}" fill="#08080c"/>
</svg>`;
}

const outputs = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.25 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.1 },
];
for (const { file, size, padding } of outputs) {
  await sharp(Buffer.from(icon(padding)))
    .resize(size, size)
    .png()
    .toFile(PUBLIC + file);
}
console.log(`${outputs.length} icônes générées.`);
