import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GameEvent } from '@umbra/engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRooms, saveRooms } from '../src/persistence.ts';
import { ABSENT_GRACE_MS, type Room, RoomManager } from '../src/rooms.ts';

let manager: RoomManager;
let autoPlayed: GameEvent[][];

beforeEach(() => {
  vi.useFakeTimers();
  manager = new RoomManager();
  autoPlayed = [];
  manager.onAutoPlay = (_room, events) => autoPlayed.push(events);
});

afterEach(() => {
  manager.dispose();
  vi.useRealTimers();
});

/** Partie lancée à 3 joueurs ; `connected` indique qui a un téléphone connecté. */
function startedGame(connected = [true, true, true], turnSeconds: 30 | 60 | 90 | null = null) {
  const room = manager.createRoom();
  const members = ['Alice', 'Bob', 'Chloé'].map((name) => manager.join(room, name));
  for (const [i, m] of members.entries()) if (connected[i]) manager.setConnected(room, m.id, 1);
  const [host, second, third] = members as [(typeof members)[0], (typeof members)[0], (typeof members)[0]];
  manager.updateSettings(room, host.id, { turnSeconds });
  manager.start(room, host.id);
  return { room, host, second, third };
}

describe('joueurs absents', () => {
  it('joue à la place des déconnectés après un délai de grâce, quand ils sont les seuls à attendre', () => {
    const { room, host, second, third } = startedGame([true, true, false]);
    manager.act(room, host.id, { type: 'bid', amount: 0 });
    expect(room.deadline).toBeNull(); // Bob, connecté, n'a pas encore misé

    manager.act(room, second.id, { type: 'bid', amount: 0 });
    expect(room.deadline).toMatchObject({ reason: 'absents' });
    expect(manager.snapshot(room).timer).toEqual({ endsInMs: ABSENT_GRACE_MS, reason: 'absents' });

    vi.advanceTimersByTime(ABSENT_GRACE_MS - 1);
    expect(room.game!.phase).toBe('bidding');
    vi.advanceTimersByTime(1);
    expect(room.game!.phase).toBe('planning');
    expect(room.game!.round.revealedBids?.[third.id]).toBe(0);
    expect(autoPlayed).toHaveLength(1);
  });

  it("sort l'absent du jeu à la manche suivante, puis le réintègre quand il revient", () => {
    const { room, host, second, third } = startedGame([true, true, false]);
    manager.act(room, host.id, { type: 'bid', amount: 0 });
    manager.act(room, second.id, { type: 'bid', amount: 0 });
    vi.advanceTimersByTime(ABSENT_GRACE_MS);
    // Absent : il joue la Lame pour finir la manche, sans qu'on l'attende.
    expect(room.game!.absent).toEqual([third.id]);
    expect(room.game!.round.plans[third.id]).toBeDefined();

    manager.act(room, host.id, { type: 'plan', plan: { equipment: { card: 'lame-du-chasseur', slot: 0 }, boost: 0 } });
    manager.act(room, second.id, {
      type: 'plan',
      plan: { equipment: { card: 'lame-du-chasseur', slot: 0 }, boost: 0 },
    });
    expect(room.game!.phase).toBe('recap');
    manager.act(room, host.id, { type: 'ready' });
    manager.act(room, second.id, { type: 'ready' });

    // Manche 2 : on ne l'attend plus du tout, aucun délai de grâce.
    expect(room.game!.round.participants).toEqual([host.id, second.id]);
    manager.act(room, host.id, { type: 'bid', amount: 0 });
    manager.act(room, second.id, { type: 'bid', amount: 0 });
    expect(room.game!.phase).toBe('planning');
    expect(room.deadline).toBeNull();

    // Il revient : il reprendra à la manche suivante.
    const events = manager.setConnected(room, third.id, 1);
    expect(events).toContainEqual({ type: 'playerReturned', playerId: third.id, nextRound: true });
    expect(room.game!.absent).toEqual([]);
  });

  it("annule le délai de grâce quand l'absent revient", () => {
    const { room, host, second, third } = startedGame([true, true, false]);
    manager.act(room, host.id, { type: 'bid', amount: 0 });
    manager.act(room, second.id, { type: 'bid', amount: 0 });
    expect(room.deadline).not.toBeNull();
    manager.setConnected(room, third.id, 1);
    expect(room.deadline).toBeNull();
    vi.advanceTimersByTime(ABSENT_GRACE_MS * 2);
    expect(room.game!.phase).toBe('bidding');
  });

  it('ne fait pas jouer la partie toute seule quand plus personne n’est connecté', () => {
    const { room } = startedGame([false, false, false]);
    expect(room.deadline).toBeNull();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(room.game!.phase).toBe('bidding');
  });
});

describe('chrono par phase', () => {
  it('joue un coup par défaut pour tous les retardataires à la fin du chrono', () => {
    const { room, host } = startedGame([true, true, true], 30);
    expect(room.deadline).toMatchObject({ reason: 'chrono' });
    manager.act(room, host.id, { type: 'bid', amount: 1 });

    vi.advanceTimersByTime(30_000);
    expect(room.game!.phase).toBe('planning');
    expect(room.game!.round.order[0]).toBe(host.id);

    // Nouveau chrono pour la planification, puis le récapitulatif.
    vi.advanceTimersByTime(30_000);
    expect(room.game!.phase).toBe('recap');
    expect(room.lastResolution?.some((e) => e.type === 'resolutionStarted')).toBe(true);
    vi.advanceTimersByTime(30_000);
    expect(room.game!.round.number).toBe(2);
  });

  it("ne relance pas le chrono à chaque action d'une même phase", () => {
    const { room, host, second } = startedGame([true, true, true], 30);
    vi.advanceTimersByTime(20_000);
    manager.act(room, host.id, { type: 'bid', amount: 0 });
    manager.act(room, second.id, { type: 'bid', amount: 0 });
    vi.advanceTimersByTime(10_000);
    expect(room.game!.phase).toBe('planning');
  });
});

describe("l'hôte joue à la place d'un joueur", () => {
  it('joue le coup par défaut, et seulement pour un joueur qui n’a pas encore agi', () => {
    const { room, host, second, third } = startedGame();
    const codeOf = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as { code?: string }).code;
      }
      return undefined;
    };
    expect(codeOf(() => manager.skip(room, second.id, third.id))).toBe('NOT_HOST');
    manager.skip(room, host.id, third.id);
    expect(room.game!.round.bids[third.id]).toBe(0);
    expect(codeOf(() => manager.skip(room, host.id, third.id))).toBe('ALREADY_PLAYED');
  });
});

describe('sauvegarde sur disque', () => {
  it('retrouve les parties en cours après un redémarrage, joueurs à reconnecter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'umbra-'));
    const file = join(dir, 'rooms.json');
    try {
      const { room, host } = startedGame();
      manager.act(room, host.id, { type: 'bid', amount: 1 });
      saveRooms(file, manager.rooms.values());

      const restarted = new RoomManager();
      restarted.restore(loadRooms(file));
      const copy = restarted.getRoom(room.code);
      expect(copy.game).toEqual(room.game);
      expect(copy.members.every((m) => m.connections === 0)).toBe(true);
      expect(restarted.resume(copy, host.token).id).toBe(host.id);
      restarted.dispose();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignore un fichier absent ou corrompu, et les salons trop anciens', () => {
    expect(loadRooms('/nexiste/pas.json')).toEqual([]);
    const dir = mkdtempSync(join(tmpdir(), 'umbra-'));
    try {
      const file = join(dir, 'rooms.json');
      const old = { ...manager.createRoom(), lastActivity: 0 } as Room;
      saveRooms(file, [old]);
      expect(loadRooms(file)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
