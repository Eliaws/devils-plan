import type { PlayerId } from '@umbra/engine';

/** Une couleur par joueur (12 max), assez distinctes sur fond sombre. */
const PALETTE = [
  '#e3ac52',
  '#5eb1ef',
  '#e5484d',
  '#4cc38a',
  '#a87ff0',
  '#f76b15',
  '#3dd6d0',
  '#e93d82',
  '#bdee63',
  '#8d8dff',
  '#ffc53d',
  '#d6409f',
] as const;

/** Couleur stable d'un joueur : sa place dans la liste des joueurs de la partie. */
export function playerColor(view: { players: readonly { id: PlayerId }[] }, playerId: PlayerId): string {
  const index = view.players.findIndex((p) => p.id === playerId);
  return PALETTE[Math.max(index, 0) % PALETTE.length]!;
}

/** Initiales (2 lettres max) pour les jetons de joueur. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? `${words[0]![0]}${words[1]![0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}
