// Point d'entrée : un seul processus Node sert le site compilé (apps/web/dist)
// et les connexions temps réel Socket.IO, sur le même port.

import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const { httpServer, io, manager, servesWeb } = createApp({
  webDist: fileURLToPath(new URL('../../web/dist', import.meta.url)),
});

setInterval(() => manager.cleanup(), CLEANUP_INTERVAL_MS).unref();

httpServer.listen(PORT, HOST, () => {
  console.log(`Chasseurs de l'Ombre : http://localhost:${PORT}${servesWeb ? '' : ' (API seule, front non compilé)'}`);
});

const shutdown = () => {
  io.close();
  httpServer.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
