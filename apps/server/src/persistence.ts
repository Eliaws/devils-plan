// Sauvegarde des salons sur disque : une partie en cours survit à un redémarrage
// du serveur (mise à jour, plantage). Les joueurs se reconnectent avec leur jeton.

import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ROOM_TTL_MS, type Room } from './rooms.ts';

interface SaveFile {
  version: 1;
  savedAt: number;
  rooms: Room[];
}

/** Lit les salons sauvegardés. Fichier absent ou illisible : aucun salon. */
export function loadRooms(file: string, now = Date.now()): Room[] {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8')) as SaveFile;
    if (data.version !== 1 || !Array.isArray(data.rooms)) return [];
    // Les salons trop anciens auraient été supprimés : on ne les ressuscite pas.
    return data.rooms.filter((room) => now - room.lastActivity < ROOM_TTL_MS);
  } catch {
    return [];
  }
}

/** Écrit tous les salons d'un coup, de façon atomique (fichier temporaire puis renommage). */
export function saveRooms(file: string, rooms: Iterable<Room>): void {
  mkdirSync(dirname(file), { recursive: true });
  const data: SaveFile = { version: 1, savedAt: Date.now(), rooms: [...rooms] };
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(data));
  renameSync(temporary, file);
}

/**
 * Regroupe les sauvegardes : au plus une écriture par `delayMs`, même si les actions s'enchaînent.
 * `flush` écrit immédiatement (arrêt du serveur).
 */
export function createSaver(save: () => void, delayMs = 1000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      save();
    } catch (error) {
      console.error('Sauvegarde des parties impossible :', error);
    }
  };
  return {
    schedule() {
      timer ??= setTimeout(flush, delayMs);
    },
    flush,
  };
}
