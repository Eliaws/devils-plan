import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer, type RequestListener } from 'node:http';
import sirv from 'sirv';
import { Server } from 'socket.io';
import type { GifProvider } from './giphy.ts';
import { RoomManager } from './rooms.ts';
import { attachGameServer, type GameServer } from './socket.ts';

export interface App {
  httpServer: HttpServer;
  io: GameServer;
  manager: RoomManager;
  /** Vrai si le site compilé est servi par ce serveur. */
  servesWeb: boolean;
}

/** Serveur HTTP (site compilé + /health) et Socket.IO sur le même port. */
export function createApp(options: { webDist?: string; gifs?: GifProvider | null; version?: string } = {}): App {
  const serveWeb =
    options.webDist && existsSync(options.webDist)
      ? sirv(options.webDist, {
          single: true,
          etag: true,
          setHeaders: (res, pathname) => {
            // Les fichiers de /assets ont un nom unique à chaque build : cache illimité.
            if (pathname.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            // Le reste (page, service worker, manifeste) est revérifié à chaque fois :
            // c'est ainsi que les téléphones découvrent une nouvelle version.
            else res.setHeader('Cache-Control', 'no-cache');
          },
        })
      : null;

  const handler: RequestListener = (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
      return;
    }
    // Diagnostic de déploiement : quel commit tourne, et les GIF sont-ils activés ?
    if (req.url === '/version') {
      res
        .writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        .end(JSON.stringify({ version: options.version ?? 'inconnue', gifs: Boolean(options.gifs) }));
      return;
    }
    if (serveWeb) {
      serveWeb(req, res, () => {
        res.writeHead(404).end();
      });
      return;
    }
    res
      .writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      .end('Front non compilé : lancez « npm run build ».');
  };

  const httpServer = createServer(handler);
  const io: GameServer = new Server(httpServer, { serveClient: false });
  const manager = new RoomManager();
  attachGameServer(io, manager, options.gifs ?? null);
  return { httpServer, io, manager, servesWeb: serveWeb !== null };
}
