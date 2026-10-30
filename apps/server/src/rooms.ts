// Gestion des salons, sans réseau : testable directement.
// La couche Socket.IO (socket.ts) traduit les messages en appels à RoomManager.

import { randomInt, randomUUID } from 'node:crypto';
import {
  type Action,
  apply,
  createGame,
  DEFAULT_CARD_SET,
  defaultAction,
  type GameEvent,
  GameRuleError,
  type GameState,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type PlayerId,
  waitingPlayers,
} from '@umbra/engine';
import {
  type GameActionInput,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type RoomSettings,
  type RoomSnapshot,
  type RoomStatus,
  type TeamId,
} from '@umbra/protocol';

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

export interface Deadline {
  at: number;
  reason: 'chrono' | 'absents';
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
  /** Événements bruts de la dernière résolution (renvoyés à la reconnexion). */
  lastResolution: GameEvent[] | null;
  /** Moment où le serveur jouera à la place des retardataires. */
  deadline: Deadline | null;
  /** Phase en cours (« manche-phase ») et son début, pour le chrono. */
  phaseKey: string | null;
  phaseStartedAt: number;
}

/** Durée après laquelle un salon sans aucune connexion est supprimé. */
export const ROOM_TTL_MS = 30 * 60 * 1000;
/** Quand seuls des joueurs déconnectés restent à jouer, on les attend ce temps-là. */
export const ABSENT_GRACE_MS = 20 * 1000;

const DEFAULT_SETTINGS: RoomSettings = { cardSet: DEFAULT_CARD_SET, turnSeconds: null };

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  /** Le serveur a joué à la place de retardataires : à diffuser aux clients. */
  onAutoPlay: (room: Room, events: GameEvent[]) => void = () => {};
  /** Un salon a changé (sauvegarde sur disque). */
  onChange: () => void = () => {};
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

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
      settings: { ...DEFAULT_SETTINGS },
      members: [],
      hostId: null,
      game: null,
      tables: 0,
      lastActivity: now,
      lastResolution: null,
      deadline: null,
      phaseKey: null,
      phaseStartedAt: now,
    };
    this.rooms.set(code, room);
    this.touch(room);
    return room;
  }

  /** Recharge des salons sauvegardés (après un redémarrage du serveur). */
  restore(rooms: Room[]): void {
    for (const room of rooms) {
      room.tables = 0;
      room.deadline = null;
      room.phaseKey = null;
      room.settings = { ...DEFAULT_SETTINGS, ...room.settings };
      for (const member of room.members) member.connections = 0;
      // Parties sauvegardées avant la gestion des absents.
      if (room.game) {
        room.game.absent ??= [];
        room.game.round.participants ??= room.game.players.map((p) => p.id);
      }
      this.rooms.set(room.code, room);
    }
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

  /**
   * Un onglet de ce joueur s'est connecté (+1) ou déconnecté (-1).
   * Un joueur absent qui revient reprend sa place : renvoie les événements correspondants.
   */
  setConnected(room: Room, playerId: PlayerId, delta: 1 | -1): GameEvent[] {
    const member = room.members.find((m) => m.id === playerId);
    if (!member) return [];
    member.connections = Math.max(0, member.connections + delta);
    if (delta === 1 && room.status === 'playing' && room.game?.absent.includes(playerId)) {
      return this.applyAction(room, { type: 'rejoin', playerId });
    }
    this.touch(room);
    this.schedule(room);
    return [];
  }

  /** Un écran « Table » s'est connecté (+1) ou déconnecté (-1). */
  setTableConnected(room: Room, delta: 1 | -1): void {
    room.tables = Math.max(0, room.tables + delta);
    this.touch(room);
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

  updateSettings(room: Room, playerId: PlayerId, settings: Partial<RoomSettings>): void {
    this.requireLobby(room);
    this.requireHost(room, playerId);
    room.settings = { ...room.settings, ...settings };
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
      room.lastResolution = null;
      this.touch(room);
      this.schedule(room);
      return events;
    } catch (error) {
      if (error instanceof GameRuleError) throw new RoomError(error.code, error.message);
      throw error;
    }
  }

  act(room: Room, playerId: PlayerId, input: GameActionInput): GameEvent[] {
    this.requirePlaying(room);
    this.requireMember(room, playerId);
    return this.applyAction(room, { ...input, playerId } as Action);
  }

  /** L'hôte joue le coup par défaut à la place d'un joueur qui tarde ou s'est déconnecté. */
  skip(room: Room, hostId: PlayerId, targetId: PlayerId): GameEvent[] {
    this.requireHost(room, hostId);
    const game = this.requirePlaying(room);
    const target = this.requireMember(room, targetId);
    const action = this.replacementFor(room, game, targetId);
    if (!action) throw new RoomError('ALREADY_PLAYED', `${target.name} a déjà joué.`);
    return this.applyAction(room, action);
  }

  /** Retour au lobby avec les mêmes joueurs, après la fin d'une partie. */
  restart(room: Room, playerId: PlayerId): void {
    this.requireHost(room, playerId);
    if (room.status !== 'finished') throw new RoomError('GAME_IN_PROGRESS', "La partie n'est pas terminée.");
    room.status = 'lobby';
    room.game = null;
    room.lastResolution = null;
    this.touch(room);
    this.schedule(room);
  }

  snapshot(room: Room, now = Date.now()): RoomSnapshot {
    return {
      code: room.code,
      status: room.status,
      settings: { ...room.settings },
      hostId: room.hostId,
      players: room.members.map((m) => ({ id: m.id, name: m.name, teamId: m.teamId, connected: m.connections > 0 })),
      timer: room.deadline ? { endsInMs: Math.max(0, room.deadline.at - now), reason: room.deadline.reason } : null,
    };
  }

  /** Supprime les salons sans connexion depuis plus de ROOM_TTL_MS. Renvoie les codes supprimés. */
  cleanup(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const room of this.rooms.values()) {
      const connected = room.tables > 0 || room.members.some((m) => m.connections > 0);
      if (!connected && now - room.lastActivity > ROOM_TTL_MS) {
        this.clearTimer(room);
        this.rooms.delete(room.code);
        removed.push(room.code);
      }
    }
    if (removed.length > 0) this.onChange();
    return removed;
  }

  /** Arrête tous les minuteurs (fin des tests, arrêt du serveur). */
  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  touch(room: Room, now = Date.now()): void {
    room.lastActivity = now;
    this.onChange();
  }

  requireMember(room: Room, playerId: PlayerId): Member {
    const member = room.members.find((m) => m.id === playerId);
    if (!member) throw new RoomError('NOT_IN_ROOM', 'Vous ne faites pas partie de cette partie.');
    return member;
  }

  // --- Coups joués et minuteurs ----------------------------------------------

  private applyAction(room: Room, action: Action): GameEvent[] {
    const result = apply(room.game!, action);
    if (!result.ok) throw new RoomError(result.error.code, result.error.message);
    room.game = result.state;
    if (result.state.phase === 'gameOver') room.status = 'finished';
    if (result.events.some((e) => e.type === 'resolutionStarted')) room.lastResolution = result.events;
    this.touch(room);
    this.schedule(room);
    return result.events;
  }

  /**
   * Programme le moment où le serveur jouera pour les retardataires :
   * - chrono de la phase, si l'hôte l'a activé ;
   * - délai de grâce, quand tous ceux qui restent à jouer sont déconnectés.
   * Personne n'est connecté : on attend (la partie ne se joue pas toute seule).
   */
  schedule(room: Room, now = Date.now()): void {
    this.clearTimer(room);
    room.deadline = null;
    const game = room.game;
    if (room.status !== 'playing' || !game) return;

    const key = `${game.round.number}-${game.phase}`;
    if (key !== room.phaseKey) {
      room.phaseKey = key;
      room.phaseStartedAt = now;
    }

    const waiting = waitingPlayers(game);
    const anyoneConnected = room.members.some((m) => m.connections > 0);
    if (waiting.length === 0 || !anyoneConnected) return;

    const candidates: Deadline[] = [];
    if (room.settings.turnSeconds) {
      candidates.push({ at: room.phaseStartedAt + room.settings.turnSeconds * 1000, reason: 'chrono' });
    }
    const onlyAbsentsLeft = waiting.every((id) => (room.members.find((m) => m.id === id)?.connections ?? 0) === 0);
    if (onlyAbsentsLeft) candidates.push({ at: now + ABSENT_GRACE_MS, reason: 'absents' });

    const deadline = candidates.sort((a, b) => a.at - b.at)[0];
    if (!deadline) return;
    room.deadline = deadline;
    this.timers.set(
      room.code,
      setTimeout(() => this.autoPlay(room), Math.max(0, deadline.at - now)),
    );
  }

  /** Temps écoulé : coup par défaut pour chaque joueur qui n'a pas encore agi. */
  private autoPlay(room: Room): void {
    this.timers.delete(room.code);
    const game = room.game;
    if (!game || room.status !== 'playing') return;
    const events: GameEvent[] = [];
    for (const playerId of waitingPlayers(game)) {
      const action = room.game && this.replacementFor(room, room.game, playerId);
      if (action) events.push(...this.applyAction(room, action));
    }
    this.onAutoPlay(room, events);
  }

  /**
   * Coup à jouer pour un joueur qui n'agit pas. Déconnecté : il est déclaré absent (coups par défaut
   * jusqu'à la fin de la manche, puis il ne joue plus). Connecté mais lent : un seul coup par défaut.
   */
  private replacementFor(room: Room, game: GameState, playerId: PlayerId): Action | null {
    if (!waitingPlayers(game).includes(playerId)) return null;
    const connected = (room.members.find((m) => m.id === playerId)?.connections ?? 0) > 0;
    return connected ? defaultAction(game, playerId) : { type: 'leave', playerId };
  }

  private clearTimer(room: Room): void {
    const timer = this.timers.get(room.code);
    if (timer) clearTimeout(timer);
    this.timers.delete(room.code);
  }

  private requirePlaying(room: Room): GameState {
    if (room.status !== 'playing' || !room.game) throw new RoomError('NO_GAME', "Aucune partie n'est en cours.");
    return room.game;
  }

  private requireHost(room: Room, playerId: PlayerId): void {
    if (room.hostId !== playerId) throw new RoomError('NOT_HOST', "Seul l'hôte peut faire ça.");
  }

  private requireLobby(room: Room): void {
    if (room.status !== 'lobby') throw new RoomError('GAME_IN_PROGRESS', 'La partie a déjà commencé.');
  }
}
