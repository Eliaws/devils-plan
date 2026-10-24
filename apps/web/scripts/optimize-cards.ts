// Convertit les illustrations PNG (≈3 Mo chacune) de /assets en WebP légers pour le site.
// Usage : npm run cards -w @chasseurs/web

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ASSETS = fileURLToPath(new URL('../../../assets/', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../src/assets/cards/', import.meta.url));
const WIDTH = 480;

/** Fichier source (relatif à /assets) -> identifiant de carte utilisé par le moteur. */
const SOURCES: Record<string, string> = {
  'monstres/Loup Garou.png': 'loup-garou',
  'monstres/Momie.png': 'momie',
  'monstres/Sylvestre furieux.png': 'sylvestre-furieux',
  'monstres/Franck.png': 'frankenstein',
  'monstres/Vampire.png': 'vampire',
  'monstres/Epouvantail.png': 'epouvantail',
  'monstres/Sorcière.png': 'sorciere',
  'monstres/Sirène.png': 'sirene',
  'monstres/Gargouille.png': 'gargouille',
  'monstres/Zombie.png': 'zombie',
  'monstres/Yéti.png': 'yeti',
  'monstres/Golem.png': 'golem',
  'monstres/La Faucheuse.png': 'la-faucheuse',
  'items/Lame du chasseur.png': 'lame-du-chasseur',
  'items/Double griffes.png': 'double-griffe',
  'items/Poison.png': 'poison',
  'items/Souffle de glace.png': 'souffle-de-glace',
  'items/Citrouille explosive.png': 'citrouille-explosive',
  "items/Charge de l'abo.png": 'charge-abomination',
  'items/Envoutement.png': 'envoutement',
  'items/Morsure.png': 'morsure',
  'items/Poing infernal.png': 'poing-infernal',
  'pouvoirs/chasseurdelombredernierenvoi/Bouclier du héros.png': 'bouclier-du-heros',
  'pouvoirs/chasseurdelombredernierenvoi/Vague de choc.png': 'vague-de-choc',
  "pouvoirs/chasseurdelombredernierenvoi/L'éclaireur.png": 'eclaireur',
  "pouvoirs/chasseurdelombredernierenvoi/L'échange macabre.png": 'echange-macabre',
  "pouvoirs/chasseurdelombredernierenvoi/Sceau d'annulation.png": 'sceau-annulation',
  'pouvoirs/chasseurdelombredernierenvoi/Marqueur du chasseur.png': 'marque-du-chasseur',
  'pouvoirs/chasseurdelombredernierenvoi/Le filet magique.png': 'filet-magique',
};

await mkdir(OUTPUT, { recursive: true });
let total = 0;
for (const [source, id] of Object.entries(SOURCES)) {
  const info = await sharp(ASSETS + source)
    .resize({ width: WIDTH, height: Math.round(WIDTH * 1.5), fit: 'cover' })
    .webp({ quality: 78 })
    .toFile(`${OUTPUT}${id}.webp`);
  total += info.size;
}
console.log(`${Object.keys(SOURCES).length} cartes converties (${Math.round(total / 1024)} Ko au total).`);
