// Branche Socket.IO sur RoomManager : validation des messages, salons Socket.IO,
// et envoi à chaque client de SA vue de la partie (jamais l'état brut).

import { randomUUID } from 'node:crypto';
import { eventsFor, type GameEvent, type PlayerId, type Viewer, viewFor } from '@umbra/engine';
import {
  type ClientToServerEvents,
  type ErrorPayload,
  gameActionSchema,
  joinInputSchema,
  REACTION_COOLDOWN_MS,
  type Result,
  reactionInputSchema,
  resumeInputSchema,
  type ServerToClientEvents,
  settingsInputSchema,
  teamInputSchema,
  watchInputSchema,
} from '@umbra/protocol';
import type { Server, Socket } from 'socket.io';
import { ZodError } from 'zod';
import { type Member, type Room, RoomError, type RoomManager } from './rooms.ts';

interface SocketData {
  code: string | null;
  /** null pour un écran « Table ». */
  playerId: PlayerId | null;
  lastReactionAt: number;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const channel = (code: string) => `room:${code}`;

export function attachGameServer(io: GameServer, manager: RoomManager): void {
  const broadcastRoom = (room: Room) => {
    io.to(channel(room.code)).emit('room:update', manager.snapshot(room));
  };

  const viewerOf = (socket: GameSocket): Viewer =>
    socket.data.playerId ? { kind: 'player', playerId: socket.data.playerId } : { kind: 'table' };

  const sendGame = (socket: GameSocket, room: Room, events: GameEvent[]) => {
    if (!room.game) return;
    const viewer = viewerOf(socket);
    socket.emit('game:update', { view: viewFor(room.game, viewer), events: eventsFor(room.game, events, viewer) });
  };

  const broadcastGame = (room: Room, events: GameEvent[]) => {
    const ids = io.sockets.adapter.rooms.get(channel(room.code)) ?? new Set<string>();
    for (const id of ids) {
      const socket = io.sockets.sockets.get(id);
      if (socket) sendGame(socket, room, events);
    }
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
    if (playerId) {
      const member = room.members.find((m) => m.id === playerId);
      if (member) member.connections = Math.max(0, member.connections - 1);
    } else {
      room.tables = Math.max(0, room.tables - 1);
    }
    manager.touch(room);
    broadcastRoom(room);
  };

  const attachPlayer = (socket: GameSocket, room: Room, member: Member) => {
    detach(socket);
    socket.data.code = room.code;
    socket.data.playerId = member.id;
    member.connections += 1;
    void socket.join(channel(room.code));
    broadcastRoom(room);
    sendGame(socket, room, []);
  };

  /** Contexte du joueur courant, ou erreur s'il n'a pas rejoint de partie. */
  const current = (socket: GameSocket): { room: Room; playerId: PlayerId } => {
    const { code, playerId } = socket.data;
    if (!code || !playerId) throw new RoomError('NOT_IN_ROOM', "Vous n'avez rejoint aucune partie.");
    return { room: manager.getRoom(code), playerId };
  };

  io.on('connection', (socket) => {
    socket.data = { code: null, playerId: null, lastReactionAt: 0 };

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
        room.tables += 1;
        void socket.join(channel(code));
        socket.emit('room:update', manager.snapshot(room));
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
        const wasPlaying = room.status === 'playing';
        const events = manager.act(room, playerId, action);
        if (wasPlaying && room.status !== 'playing') broadcastRoom(room);
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
      handle(ack, () => {
        const payload = reactionInputSchema.parse(input);
        const { room, playerId } = current(socket);
        const now = Date.now();
        if (now - socket.data.lastReactionAt < REACTION_COOLDOWN_MS) {
          throw new RoomError('TOO_FAST', 'Doucement, une réaction à la fois !');
        }
        socket.data.lastReactionAt = now;
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

function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof RoomError) return { code: error.code, message: error.message };
  if (error instanceof ZodError) {
    return { code: 'INVALID_INPUT', message: error.issues[0]?.message ?? 'Données invalides.' };
  }
  console.error(error);
  return { code: 'INTERNAL', message: 'Erreur interne du serveur.' };
}
