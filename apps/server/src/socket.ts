// Branche Socket.IO sur RoomManager : validation des messages, salons Socket.IO,
// et envoi à chaque client de SA vue de la partie (jamais l'état brut).

import { randomUUID } from 'node:crypto';
import { eventsFor, type GameEvent, type PlayerId, type Viewer, viewFor } from '@umbra/engine';
import {
  avatarInputSchema,
  type ClientToServerEvents,
  type ErrorPayload,
  GIF_REACTION_COOLDOWN_MS,
  gameActionSchema,
  gifSearchInputSchema,
  joinInputSchema,
  REACTION_COOLDOWN_MS,
  type ReactionPayload,
  type Result,
  type RoomSnapshot,
  reactionInputSchema,
  resumeInputSchema,
  type ServerToClientEvents,
  settingsInputSchema,
  skipInputSchema,
  teamInputSchema,
  watchInputSchema,
} from '@umbra/protocol';
import type { Server, Socket } from 'socket.io';
import { ZodError } from 'zod';
import { type GifProvider, GifUnavailableError } from './giphy.ts';
import { type Member, type Room, RoomError, type RoomManager } from './rooms.ts';

interface SocketData {
  code: string | null;
  /** null pour un écran « Table ». */
  playerId: PlayerId | null;
  lastReactionAt: number;
  lastGifAt: number;
  lastGifSearchAt: number;
}

/** Délai minimal entre deux recherches de GIF d'un même téléphone (la saisie est déjà temporisée). */
const GIF_SEARCH_INTERVAL_MS = 250;

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const channel = (code: string) => `room:${code}`;

export function attachGameServer(io: GameServer, manager: RoomManager, gifs: GifProvider | null = null): void {
  const snapshot = (room: Room): RoomSnapshot => ({ ...manager.snapshot(room), gifs: gifs !== null });

  const broadcastRoom = (room: Room) => {
    io.to(channel(room.code)).emit('room:update', snapshot(room));
  };

  const viewerOf = (socket: GameSocket): Viewer =>
    socket.data.playerId ? { kind: 'player', playerId: socket.data.playerId } : { kind: 'table' };

  /** `withRecap` : (re)connexion pendant le récapitulatif, on renvoie le résumé de la dernière manche. */
  const sendGame = (socket: GameSocket, room: Room, events: GameEvent[], withRecap = false) => {
    if (!room.game) return;
    const viewer = viewerOf(socket);
    const replayRecap = withRecap && room.lastResolution && ['recap', 'gameOver'].includes(room.game.phase);
    socket.emit('game:update', {
      view: viewFor(room.game, viewer),
      events: eventsFor(room.game, events, viewer),
      ...(replayRecap && room.lastResolution
        ? { lastResolution: eventsFor(room.game, room.lastResolution, viewer) }
        : {}),
    });
  };

  const broadcastGame = (room: Room, events: GameEvent[]) => {
    const ids = io.sockets.adapter.rooms.get(channel(room.code)) ?? new Set<string>();
    for (const id of ids) {
      const socket = io.sockets.sockets.get(id);
      if (socket) sendGame(socket, room, events);
    }
  };

  // Minuteur écoulé : le serveur a joué pour les retardataires, on prévient tout le monde.
  manager.onAutoPlay = (room, events) => {
    broadcastRoom(room);
    broadcastGame(room, events);
  };

  /** Détache le socket de son salon actuel (changement de salon ou déconnexion). */
  const detach = (socket: GameSocket) => {
    const { code, playerId } = socket.data;
    if (!code) return;
    socket.data.code = null;
    socket.data.playerId = null;
    void socket.leave(channel(code));
    const room = manager.rooms.get(code);
    if (!room) return;
    if (playerId) manager.setConnected(room, playerId, -1);
    else manager.setTableConnected(room, -1);
    broadcastRoom(room);
  };

  const attachPlayer = (socket: GameSocket, room: Room, member: Member) => {
    detach(socket);
    socket.data.code = room.code;
    socket.data.playerId = member.id;
    void socket.join(channel(room.code));
    const events = manager.setConnected(room, member.id, 1);
    broadcastRoom(room);
    // Retour d'un absent : tout le monde est prévenu ; lui reçoit en plus le récap éventuel.
    if (events.length > 0) broadcastGame(room, events);
    sendGame(socket, room, [], true);
  };

  const requireGifs = (): GifProvider => {
    if (!gifs) throw new RoomError('GIFS_DISABLED', 'Les GIF ne sont pas activés sur ce serveur.');
    return gifs;
  };

  /** Contexte du joueur courant, ou erreur s'il n'a pas rejoint de partie. */
  const current = (socket: GameSocket): { room: Room; playerId: PlayerId } => {
    const { code, playerId } = socket.data;
    if (!code || !playerId) throw new RoomError('NOT_IN_ROOM', "Vous n'avez rejoint aucune partie.");
    return { room: manager.getRoom(code), playerId };
  };

  io.on('connection', (socket) => {
    socket.data = { code: null, playerId: null, lastReactionAt: 0, lastGifAt: 0, lastGifSearchAt: 0 };

    socket.on('room:create', (ack) => {
      handle(ack, () => ({ code: manager.createRoom().code }));
    });

    socket.on('room:join', (input, ack) => {
      handle(ack, () => {
        const { code, name } = joinInputSchema.parse(input);
        const room = manager.getRoom(code);
        const member = manager.join(room, name);
        attachPlayer(socket, room, member);
        return { code, playerId: member.id, token: member.token };
      });
    });

    socket.on('room:resume', (input, ack) => {
      handle(ack, () => {
        const { code, token } = resumeInputSchema.parse(input);
        const room = manager.getRoom(code);
        const member = manager.resume(room, token);
        attachPlayer(socket, room, member);
        return { code, playerId: member.id, token: member.token };
      });
    });

    socket.on('room:watch', (input, ack) => {
      handle(ack, () => {
        const { code } = watchInputSchema.parse(input);
        const room = manager.getRoom(code);
        detach(socket);
        socket.data.code = code;
        manager.setTableConnected(room, 1);
        void socket.join(channel(code));
        socket.emit('room:update', snapshot(room));
        sendGame(socket, room, []);
        return null;
      });
    });

    socket.on('room:leave', (ack) => {
      handle(ack, () => {
        const { room, playerId } = current(socket);
        manager.leave(room, playerId);
        detach(socket);
        return null;
      });
    });

    socket.on('lobby:team', (input, ack) => {
      handle(ack, () => {
        const { teamId } = teamInputSchema.parse(input);
        const { room, playerId } = current(socket);
        manager.setTeam(room, playerId, teamId);
        broadcastRoom(room);
        return null;
      });
    });

    socket.on('lobby:avatar', (input, ack) => {
      handle(ack, () => {
        const { avatar } = avatarInputSchema.parse(input);
        const { room, playerId } = current(socket);
        manager.setAvatar(room, playerId, avatar);
        broadcastRoom(room);
        return null;
      });
    });

    socket.on('lobby:settings', (input, ack) => {
      handle(ack, () => {
        const settings = settingsInputSchema.parse(input);
        const { room, playerId } = current(socket);
        manager.updateSettings(room, playerId, settings);
        broadcastRoom(room);
        return null;
      });
    });

    socket.on('game:start', (ack) => {
      handle(ack, () => {
        const { room, playerId } = current(socket);
        const events = manager.start(room, playerId);
        broadcastRoom(room);
        broadcastGame(room, events);
        return null;
      });
    });

    socket.on('game:action', (input, ack) => {
      handle(ack, () => {
        const action = gameActionSchema.parse(input);
        const { room, playerId } = current(socket);
        const events = manager.act(room, playerId, action);
        // Le salon change aussi : minuteur relancé, fin de partie…
        broadcastRoom(room);
        broadcastGame(room, events);
        return null;
      });
    });

    socket.on('game:skip', (input, ack) => {
      handle(ack, () => {
        const { playerId: targetId } = skipInputSchema.parse(input);
        const { room, playerId } = current(socket);
        const events = manager.skip(room, playerId, targetId);
        broadcastRoom(room);
        broadcastGame(room, events);
        return null;
      });
    });

    socket.on('game:restart', (ack) => {
      handle(ack, () => {
        const { room, playerId } = current(socket);
        manager.restart(room, playerId);
        broadcastRoom(room);
        return null;
      });
    });

    socket.on('game:react', (input, ack) => {
      handleAsync(ack, async () => {
        const reaction = reactionInputSchema.parse(input);
        const { room, playerId } = current(socket);
        const now = Date.now();
        if (now - socket.data.lastReactionAt < REACTION_COOLDOWN_MS) {
          throw new RoomError('TOO_FAST', 'Doucement, une réaction à la fois !');
        }
        if (reaction.kind === 'gif' && now - socket.data.lastGifAt < GIF_REACTION_COOLDOWN_MS) {
          throw new RoomError('TOO_FAST', 'Un GIF toutes les quelques secondes !');
        }
        socket.data.lastReactionAt = now;
        let payload: ReactionPayload;
        if (reaction.kind === 'gif') {
          socket.data.lastGifAt = now;
          const gif = await requireGifs().get(reaction.id);
          if (!gif) throw new RoomError('UNKNOWN_GIF', 'GIF introuvable.');
          payload = { kind: 'gif', gif };
        } else {
          payload = reaction;
        }
        const member = manager.requireMember(room, playerId);
        io.to(channel(room.code)).emit('room:reaction', {
          id: randomUUID(),
          playerId,
          name: member.name,
          payload,
        });
        return null;
      });
    });

    socket.on('gif:search', (input, ack) => {
      handleAsync(ack, async () => {
        const { query, offset } = gifSearchInputSchema.parse(input);
        current(socket);
        const now = Date.now();
        if (now - socket.data.lastGifSearchAt < GIF_SEARCH_INTERVAL_MS) {
          throw new RoomError('TOO_FAST', 'Recherche trop rapide.');
        }
        socket.data.lastGifSearchAt = now;
        return requireGifs().search(query, offset);
      });
    });

    socket.on('disconnect', () => detach(socket));
  });
}

/** Exécute un gestionnaire et répond via l'accusé de réception, sans jamais laisser filer d'exception. */
function handle<T>(ack: unknown, fn: () => T): void {
  let result: Result<T>;
  try {
    result = { ok: true, data: fn() };
  } catch (error) {
    result = { ok: false, error: toErrorPayload(error) };
  }
  if (typeof ack === 'function') ack(result);
}

/** Variante asynchrone de `handle`. */
function handleAsync<T>(ack: unknown, fn: () => Promise<T>): void {
  fn().then(
    (data) => {
      if (typeof ack === 'function') ack({ ok: true, data } satisfies Result<T>);
    },
    (error: unknown) => {
      if (typeof ack === 'function') ack({ ok: false, error: toErrorPayload(error) } satisfies Result<T>);
    },
  );
}

function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof RoomError) return { code: error.code, message: error.message };
  if (error instanceof GifUnavailableError) {
    console.warn(`GIF : ${error.message}`);
    return { code: 'GIFS_UNAVAILABLE', message: 'GIF indisponibles pour le moment.' };
  }
  if (error instanceof ZodError) {
    return { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Données invalides.' };
  }
  console.error(error);
  return { code: 'INTERNAL', message: 'Erreur interne du serveur.' };
}
