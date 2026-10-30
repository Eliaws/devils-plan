import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/index.ts';
import type { GameState } from '../src/types.ts';
import { act, biddingInOrder, eventsOfType, expectRejected, lame, newGame, planAll, readyAll } from './helpers.ts';

/** Fait miser 0 à tous les participants de la manche (dans l'ordre de la liste). */
function bidAll(state: GameState): GameState {
  let current = state;
  for (const id of current.round.participants) {
    if (current.round.bids[id] === undefined) current = act(current, { type: 'bid', playerId: id, amount: 0 }).state;
  }
  return current;
}

describe('joueur absent', () => {
  it('joue des coups par défaut jusqu’à la fin de la manche, puis ne joue plus', () => {
    let state = newGame();
    state = act(state, { type: 'bid', playerId: 'p1', amount: 0 }).state;

    const left = act(state, { type: 'leave', playerId: 'p3' });
    state = left.state;
    expect(eventsOfType(left.events, 'playerLeft')).toEqual([{ type: 'playerLeft', playerId: 'p3' }]);
    expect(state.round.bids.p3).toBe(0); // mise par défaut, tout de suite

    state = act(state, { type: 'bid', playerId: 'p2', amount: 0 }).state;
    expect(state.phase).toBe('planning');
    expect(state.round.plans.p3).toEqual({ equipment: { card: 'lame-du-chasseur', slot: 0 }, boost: 0 });

    state = planAll(state, { p1: lame(1), p2: lame(2) }).state;
    expect(state.phase).toBe('recap');
    expect(state.round.ready).toEqual(['p3']);

    // Manche suivante : p3 n'en fait plus partie, personne ne l'attend.
    state = readyAll(state).state;
    expect(state.round.number).toBe(2);
    expect(state.round.participants).toEqual(['p1', 'p2']);
    state = bidAll(state);
    expect(state.phase).toBe('planning');
    expect(state.round.order).not.toContain('p3');
    expectRejected(state, { type: 'plan', playerId: 'p3', plan: lame(0) }, 'NOT_PARTICIPATING');

    state = planAll(state, { p1: lame(0), p2: lame(0) }).state;
    expect(state.phase).toBe('recap');
    // Il garde ses pièces (et en gagne à chaque manche), ses cartes et ses points.
    expect(state.players[2]!.coins).toBe(2);
  });

  it('reprend sa place à la manche suivante quand il revient en cours de manche', () => {
    let state = biddingInOrder(newGame(), ['p1', 'p2', 'p3']).state;
    state = act(state, { type: 'leave', playerId: 'p3' }).state;
    state = planAll(state, { p1: lame(0), p2: lame(0) }).state;
    state = readyAll(state).state;
    state = bidAll(state);
    expect(state.phase).toBe('planning');

    const back = act(state, { type: 'rejoin', playerId: 'p3' });
    state = back.state;
    expect(eventsOfType(back.events, 'playerReturned')).toEqual([
      { type: 'playerReturned', playerId: 'p3', nextRound: true },
    ]);
    expect(viewFor(state, { kind: 'player', playerId: 'p3' }).players[2]).toMatchObject({
      isAbsent: false,
      isParticipant: false,
    });

    state = planAll(state, { p1: lame(0), p2: lame(0) }).state;
    state = readyAll(state).state;
    expect(state.round.participants).toEqual(['p1', 'p2', 'p3']);
  });

  it('rejoue tout de suite s’il revient avant la révélation des mises', () => {
    let state = biddingInOrder(newGame(), ['p1', 'p2', 'p3']).state;
    state = act(state, { type: 'leave', playerId: 'p3' }).state;
    state = planAll(state, { p1: lame(0), p2: lame(0) }).state;
    state = readyAll(state).state;
    expect(state.round.participants).toEqual(['p1', 'p2']);

    state = act(state, { type: 'rejoin', playerId: 'p3' }).state;
    expect(state.round.participants).toEqual(['p1', 'p2', 'p3']);
    state = act(state, { type: 'bid', playerId: 'p3', amount: 1 }).state;
    expect(state.round.bids.p3).toBe(1);
  });

  it('attend sans boucler quand tout le monde est parti, puis repart au premier retour', () => {
    let state = newGame();
    for (const id of ['p1', 'p2', 'p3']) state = act(state, { type: 'leave', playerId: id }).state;
    // La manche 1 se joue toute seule, puis la partie attend : personne ne participe à la manche 2.
    expect(state.round.number).toBe(2);
    expect(state.phase).toBe('bidding');
    expect(state.round.participants).toEqual([]);

    state = act(state, { type: 'rejoin', playerId: 'p2' }).state;
    state = act(state, { type: 'bid', playerId: 'p2', amount: 0 }).state;
    expect(state.phase).toBe('planning');
  });
});
