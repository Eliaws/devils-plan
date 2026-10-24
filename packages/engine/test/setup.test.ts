import { describe, expect, it } from 'vitest';
import { createGame, FINAL_MONSTER, MONSTER_IDS } from '../src/index.ts';
import { newGame } from './helpers.ts';

const players = (n: number, teams: (string | undefined)[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `J${i + 1}`,
    ...(teams[i] ? { teamId: teams[i] } : {}),
  }));

function rejectedCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
}

describe('mise en place', () => {
  it('révèle 3 monstres et place La Faucheuse au fond de la pioche', () => {
    const state = newGame();
    expect(state.board).toHaveLength(3);
    expect(state.board.every((m) => m !== null && m.damage === 0)).toBe(true);
    expect(state.monsterDeck).toHaveLength(10);
    expect(state.monsterDeck.at(-1)).toBe(FINAL_MONSTER);
    expect(state.board.map((m) => m!.id)).not.toContain(FINAL_MONSTER);
    const all = [...state.board.map((m) => m!.id), ...state.monsterDeck].sort();
    expect(all).toEqual([...MONSTER_IDS].sort());
  });

  it('donne une Lame du chasseur à chacun et démarre la manche 1 avec 1 pièce', () => {
    const state = newGame(4);
    expect(state.phase).toBe('bidding');
    expect(state.round.number).toBe(1);
    for (const p of state.players) {
      expect(p.equipment).toEqual(['lame-du-chasseur']);
      expect(p.specials).toEqual([]);
      expect(p.coins).toBe(1);
    }
  });

  it('prépare une réserve de 16 Équipements et une pioche de 16 Spéciales', () => {
    const state = newGame();
    const count = (list: string[], id: string) => list.filter((c) => c === id).length;
    expect(state.equipmentReserve).toHaveLength(16);
    expect(count(state.equipmentReserve, 'double-griffe')).toBe(4);
    expect(count(state.equipmentReserve, 'poison')).toBe(3);
    expect(count(state.equipmentReserve, 'envoutement')).toBe(1);
    expect(count(state.equipmentReserve, 'lame-du-chasseur')).toBe(0);
    expect(state.specialDeck).toHaveLength(16);
    expect(count(state.specialDeck, 'poing-infernal')).toBe(2);
    expect(count(state.specialDeck, 'filet-magique')).toBe(2);
  });

  it('est déterministe pour une graine donnée', () => {
    expect(newGame(3, { seed: 7 })).toEqual(newGame(3, { seed: 7 }));
    const boards = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        newGame(3, { seed })
          .board.map((m) => m!.id)
          .join(),
      ),
    );
    expect(boards.size).toBeGreaterThan(1);
  });

  it('crée un camp par joueur solo et un camp par équipe', () => {
    const state = newGame(7, { teams: ['A', 'A', 'B', 'B', 'B', undefined, undefined] });
    expect(state.sides.map((s) => [s.id, s.playerIds.length])).toEqual([
      ['team:A', 2],
      ['team:B', 3],
      ['solo:p6', 1],
      ['solo:p7', 1],
    ]);
  });

  it('refuse les configurations invalides', () => {
    expect(rejectedCode(() => createGame({ players: players(2), seed: 1 }))).toBe('PLAYER_COUNT');
    expect(rejectedCode(() => createGame({ players: players(13), seed: 1 }))).toBe('PLAYER_COUNT');
    expect(rejectedCode(() => createGame({ players: players(5, ['A', 'A']), seed: 1 }))).toBe('TEAMS_NOT_ALLOWED');
    expect(rejectedCode(() => createGame({ players: players(6, ['A', 'A', 'A', 'A']), seed: 1 }))).toBe(
      'TEAM_TOO_LARGE',
    );
    const dup = [...players(2), { id: 'p1', name: 'Doublon' }];
    expect(rejectedCode(() => createGame({ players: dup, seed: 1 }))).toBe('DUPLICATE_PLAYER');
  });
});
