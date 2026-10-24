// Aléatoire déterministe (mulberry32). L'état du générateur vit dans l'état de
// partie : une même graine et les mêmes actions rejouent exactement la même partie.

export interface RngHolder {
  rng: number;
}

/** Nombre dans [0, 1[. Fait avancer le générateur. */
export function random(holder: RngHolder): number {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entier dans [0, max[. */
export function randomInt(holder: RngHolder, max: number): number {
  return Math.floor(random(holder) * max);
}

/** Copie mélangée (Fisher-Yates). */
export function shuffle<T>(holder: RngHolder, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(holder, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
