import { describe, expect, it } from 'vitest';
import { apply, defaultAction, waitingPlayers } from '../src/index.ts';
import { act, biddingInOrder, lame, newGame, planAll, setBoard } from './helpers.ts';

describe('joueurs en attente et coup par défaut', () => {
  it('liste les joueurs qui doivent encore agir, phase par phase', () => {
    let state = newGame();
    expect(waitingPlayers(state)).toEqual(['p1', 'p2', 'p3']);
    state = act(state, { type: 'bid', playerId: 'p2', amount: 0 }).state;
    expect(waitingPlayers(state)).toEqual(['p1', 'p3']);

    state = biddingInOrder(newGame(), ['p1', 'p2', 'p3']).state;
    state = act(state, { type: 'plan', playerId: 'p1', plan: lame(0) }).state;
    expect(waitingPlayers(state)).toEqual(['p2', 'p3']);

    state = planAll(state, { p2: lame(0), p3: lame(0) }).state;
    expect(state.phase).toBe('recap');
    state = act(state, { type: 'ready', playerId: 'p3' }).state;
    expect(waitingPlayers(state)).toEqual(['p1', 'p2']);
  });

  it('mise 0 à la place du joueur, puis attaque le premier monstre à la Lame', () => {
    let state = newGame();
    expect(defaultAction(state, 'p1')).toEqual({ type: 'bid', playerId: 'p1', amount: 0 });

    state = biddingInOrder(state, ['p1', 'p2', 'p3']).state;
    setBoard(state, [null, 'golem', 'golem']);
    expect(defaultAction(state, 'p2')).toEqual({
      type: 'plan',
      playerId: 'p2',
      plan: { equipment: { card: 'lame-du-chasseur', slot: 1 }, boost: 0 },
    });
  });

  it('ne joue pas pour un joueur qui a déjà agi, et chaque coup par défaut est accepté par le moteur', () => {
    let state = newGame();
    state = act(state, { type: 'bid', playerId: 'p1', amount: 1 }).state;
    expect(defaultAction(state, 'p1')).toBeNull();

    // Une partie entière jouée uniquement avec des coups par défaut va jusqu'au bout.
    let guard = 0;
    while (state.phase !== 'gameOver' && guard++ < 2000) {
      const [next] = waitingPlayers(state);
      const action = defaultAction(state, next!);
      const result = apply(state, action!);
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.phase).toBe('gameOver');
  });
});
