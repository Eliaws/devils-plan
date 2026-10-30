// Point d'entrée : un seul processus Node sert le site compilé (apps/web/dist)
// et les connexions temps réel Socket.IO, sur le même port.

import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { createSaver, loadRooms, saveRooms } from './persistence.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
/** Fichier de sauvegarde des parties (créé au besoin). */
const DATA_FILE = process.env.DATA_FILE ?? fileURLToPath(new URL('../data/rooms.json', import.meta.url));
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const { httpServer, io, manager, servesWeb } = createApp({
  webDist: fileURLToPath(new URL('../../web/dist', import.meta.url)),
});

const restored = loadRooms(DATA_FILE);
manager.restore(restored);
const saver = createSaver(() => saveRooms(DATA_FILE, manager.rooms.values()));
manager.onChange = () => saver.schedule();

setInterval(() => manager.cleanup(), CLEANUP_INTERVAL_MS).unref();

httpServer.listen(PORT, HOST, () => {
  const parties = restored.length > 0 ? ` · ${restored.length} partie(s) restaurée(s)` : '';
  console.log(`Umbra : http://localhost:${PORT}${servesWeb ? '' : ' (API seule, front non compilé)'}${parties}`);
});

const shutdown = () => {
  saver.flush();
  manager.dispose();
  io.close();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
