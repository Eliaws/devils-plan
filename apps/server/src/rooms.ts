// Gestion des salons, sans réseau : testable directement.
// La couche Socket.IO (socket.ts) traduit les messages en appels à RoomManager.

import { randomInt, randomUUID } from 'node:crypto';
import {
  type Action,
  apply,
  createGame,
  DEFAULT_CARD_SET,
  type GameEvent,
  GameRuleError,
  type GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PlayerId,
} from '@chasseurs/engine';
import {
  type GameActionInput,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomSettings,
  type RoomSnapshot,
  type RoomStatus,
  type TeamId,
} from '@chasseurs/protocol';

/** Erreur destinée au joueur (message en français). */
export class RoomError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}

export interface Member {
  id: PlayerId;
  /** Secret de reconnexion, jamais envoyé aux autres joueurs. */
  token: string;
  name: string;
  teamId: TeamId | null;
  /** Nombre d'onglets connectés pour ce joueur. */
  connections: number;
}

export interface Room {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  members: Member[];
  hostId: PlayerId | null;
  game: GameState | null;
  /** Écrans « Table » connectés. */
  tables: number;
  lastActivity: number;
}

/** Durée après laquelle un salon sans aucune connexion est supprimé. */
export const ROOM_TTL_MS = 30 * 60 * 1000;

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  createRoom(now = Date.now()): Room {
    let code: string;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      status: 'lobby',
      settings: { cardSet: DEFAULT_CARD_SET },
      members: [],
      hostId: null,
      game: null,
      tables: 0,
      lastActivity: now,
    };
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', `Aucune partie avec le code ${code}.`);
    return room;
  }

  join(room: Room, name: string): Member {
    if (room.status !== 'lobby') throw new RoomError('GAME_IN_PROGRESS', 'La partie a déjà commencé.');
    if (room.members.length >= MAX_PLAYERS) {
      throw new RoomError('ROOM_FULL', `La partie est complète (${MAX_PLAYERS} joueurs).`);
    }
    if (room.members.some((m) => m.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) {
      throw new RoomError('NAME_TAKEN', `Le pseudo « ${name} » est déjà pris.`);
    }
    const member: Member = { id: randomUUID().slice(0, 8), token: randomUUID(), name, teamId: null, connections: 0 };
    room.members.push(member);
    room.hostId ??= member.id;
    this.touch(room);
    return member;
  }

  resume(room: Room, token: string): Member {
    const member = room.members.find((m) => m.token === token);
    if (!member) throw new RoomError('UNKNOWN_SESSION', "Cette place n'existe plus dans la partie.");
    this.touch(room);
    return member;
  }

  /** Quitter n'est possible que dans le lobby ; en cours de partie, la place reste réservée. */
  leave(room: Room, playerId: PlayerId): void {
    if (room.status === 'playing')
      throw new RoomError('GAME_IN_PROGRESS', 'Impossible de quitter une partie en cours.');
    room.members = room.members.filter((m) => m.id !== playerId);
    if (room.hostId === playerId) room.hostId = room.members[0]?.id ?? null;
    this.touch(room);
  }

  setTeam(room: Room, playerId: PlayerId, teamId: TeamId | null): void {
    this.requireLobby(room);
    this.requireMember(room, playerId).teamId = teamId;
    this.touch(room);
  }

  updateSettings(room: Room, playerId: PlayerId, settings: RoomSettings): void {
    this.requireLobby(room);
    this.requireHost(room, playerId);
    room.settings = { ...settings };
    this.touch(room);
  }

  start(room: Room, playerId: PlayerId): GameEvent[] {
    this.requireHost(room, playerId);
    if (room.status !== 'lobby') throw new RoomError('GAME_IN_PROGRESS', 'La partie a déjà commencé.');
    if (room.members.length < MIN_PLAYERS) {
      throw new RoomError('NOT_ENOUGH_PLAYERS', `Il faut au moins ${MIN_PLAYERS} joueurs.`);
    }
    try {
      const { state, events } = createGame({
        players: room.members.map((m) => ({ id: m.id, name: m.name, ...(m.teamId ? { teamId: m.teamId } : {}) })),
        seed: randomInt(2 ** 31),
        cardSet: room.settings.cardSet,
      });
      room.game = state;
      room.status = 'playing';
      this.touch(room);
      return events;
    } catch (error) {
      if (error instanceof GameRuleError) throw new RoomError(error.code, error.message);
      throw error;
    }
  }

  act(room: Room, playerId: PlayerId, input: GameActionInput): GameEvent[] {
    if (room.status !== 'playing' || !room.game) throw new RoomError('NO_GAME', "Aucune partie n'est en cours.");
    this.requireMember(room, playerId);
    const result = apply(room.game, { ...input, playerId } as Action);
    if (!result.ok) throw new RoomError(result.error.code, result.error.message);
    room.game = result.state;
    if (result.state.phase === 'gameOver') room.status = 'finished';
    this.touch(room);
    return result.events;
  }

  /** Retour au lobby avec les mêmes joueurs, après la fin d'une partie. */
  restart(room: Room, playerId: PlayerId): void {
    this.requireHost(room, playerId);
    if (room.status !== 'finished') throw new RoomError('GAME_IN_PROGRESS', "La partie n'est pas terminée.");
    room.status = 'lobby';
    room.game = null;
    this.touch(room);
  }

  snapshot(room: Room): RoomSnapshot {
    return {
      code: room.code,
      status: room.status,
      settings: { ...room.settings },
      hostId: room.hostId,
      players: room.members.map((m) => ({ id: m.id, name: m.name, teamId: m.teamId, connected: m.connections > 0 })),
    };
  }

  /** Supprime les salons sans connexion depuis plus de ROOM_TTL_MS. Renvoie les codes supprimés. */
  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const room of this.rooms.values()) {
      const connected = room.tables > 0 || room.members.some((m) => m.connections > 0);
      if (!connected && now - room.lastActivity > ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        removed.push(room.code);
      }
    }
    return removed;
  }

  touch(room: Room, now = Date.now()): void {
    room.lastActivity = now;
  }

  requireMember(room: Room, playerId: PlayerId): Member {
    const member = room.members.find((m) => m.id === playerId);
    if (!member) throw new RoomError('NOT_IN_ROOM', 'Vous ne faites pas partie de cette partie.');
    return member;
  }

  private requireHost(room: Room, playerId: PlayerId): void {
    if (room.hostId !== playerId) throw new RoomError('NOT_HOST', "Seul l'hôte peut faire ça.");
  }

  private requireLobby(room: Room): void {
    if (room.status !== 'lobby') throw new RoomError('GAME_IN_PROGRESS', 'La partie a déjà commencé.');
  }
}
