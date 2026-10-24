import { describe, expect, it } from 'vitest';
import { ROOM_TTL_MS, RoomManager } from '../src/rooms.ts';

function lobbyWith(...names: string[]) {
  const manager = new RoomManager();
  const room = manager.createRoom();
  const members = names.map((name) => manager.join(room, name));
  return { manager, room, members };
}

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('RoomManager', () => {
  it('crée des salons avec un code unique de 4 lettres', () => {
    const manager = new RoomManager();
    const codes = new Set(Array.from({ length: 200 }, () => manager.createRoom().code));
    expect(codes.size).toBe(200);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{4}$/);
  });

  it('le premier joueur devient hôte, et l’hôte passe au suivant s’il quitte le lobby', () => {
    const { manager, room, members } = lobbyWith('Alice', 'Bob');
    expect(room.hostId).toBe(members[0]!.id);
    manager.leave(room, members[0]!.id);
    expect(room.hostId).toBe(members[1]!.id);
  });

  it('refuse un pseudo déjà pris (sans tenir compte de la casse)', () => {
    const { manager, room } = lobbyWith('Alice');
    expect(codeOf(() => manager.join(room, 'alice'))).toBe('NAME_TAKEN');
  });

  it('retrouve un joueur grâce à son jeton, et seulement grâce à lui', () => {
    const { manager, room, members } = lobbyWith('Alice');
    expect(manager.resume(room, members[0]!.token).id).toBe(members[0]!.id);
    expect(codeOf(() => manager.resume(room, 'faux'))).toBe('UNKNOWN_SESSION');
  });

  it("réserve le lancement et les réglages à l'hôte, avec au moins 3 joueurs", () => {
    const { manager, room, members } = lobbyWith('Alice', 'Bob');
    const [alice, bob] = members as [(typeof members)[0], (typeof members)[0]];
    expect(codeOf(() => manager.start(room, bob.id))).toBe('NOT_HOST');
    expect(codeOf(() => manager.updateSettings(room, bob.id, { cardSet: 'classiques' }))).toBe('NOT_HOST');
    expect(codeOf(() => manager.start(room, alice.id))).toBe('NOT_ENOUGH_PLAYERS');

    manager.join(room, 'Chloé');
    manager.updateSettings(room, alice.id, { cardSet: 'classiques' });
    manager.start(room, alice.id);
    expect(room.status).toBe('playing');
    expect(room.game?.cardSet).toBe('classiques');
    expect(codeOf(() => manager.join(room, 'Dan'))).toBe('GAME_IN_PROGRESS');
    expect(codeOf(() => manager.leave(room, bob.id))).toBe('GAME_IN_PROGRESS');
  });

  it('transmet les erreurs de règles du moteur (équipes à moins de 6 joueurs)', () => {
    const { manager, room, members } = lobbyWith('Alice', 'Bob', 'Chloé');
    manager.setTeam(room, members[0]!.id, 'loups');
    expect(codeOf(() => manager.start(room, members[0]!.id))).toBe('TEAMS_NOT_ALLOWED');
  });

  it('applique les actions de jeu au nom du joueur connecté', () => {
    const { manager, room, members } = lobbyWith('Alice', 'Bob', 'Chloé');
    manager.start(room, members[0]!.id);
    const events = manager.act(room, members[1]!.id, { type: 'bid', amount: 1 });
    expect(events).toEqual([{ type: 'bidPlaced', playerId: members[1]!.id }]);
    expect(codeOf(() => manager.act(room, members[1]!.id, { type: 'bid', amount: 5 }))).toBe('NOT_ENOUGH_COINS');
    expect(codeOf(() => manager.act(room, 'intrus', { type: 'bid', amount: 0 }))).toBe('NOT_IN_ROOM');
  });

  it('supprime les salons abandonnés', () => {
    const { manager, room, members } = lobbyWith('Alice');
    members[0]!.connections = 1;
    const now = room.lastActivity + ROOM_TTL_MS + 1;
    expect(manager.cleanup(now)).toEqual([]);
    members[0]!.connections = 0;
    expect(manager.cleanup(now)).toEqual([room.code]);
    expect(manager.rooms.size).toBe(0);
  });
});
