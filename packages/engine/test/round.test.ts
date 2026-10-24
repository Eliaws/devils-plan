import { describe, expect, it } from 'vitest';
import { eventsOfType, give, lame, newGame, playRound, scoreOf, setBoard } from './helpers.ts';

const ORDER = ['p1', 'p2', 'p3'];

describe('fin de manche et carte Spéciale', () => {
  it('donne une carte Spéciale au joueur qui a infligé le plus de dégâts', () => {
    const state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    give(state, 'p3', { coins: 2 });
    const { state: after, events } = playRound(state, ORDER, { p1: lame(0), p2: lame(1), p3: lame(2, 2) });
    expect(eventsOfType(events, 'specialAwarded')).toEqual([
      { type: 'specialAwarded', playerId: 'p3', sideId: 'solo:p3', card: after.players[2]!.specials[0] },
    ]);
    expect(after.specialDeck).toHaveLength(13);
  });

  it('en cas d’égalité, le premier dans l’ordre de passage l’emporte', () => {
    const state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    const { events } = playRound(state, ['p2', 'p3', 'p1'], { p1: lame(0), p2: lame(1), p3: lame(2) });
    expect(eventsOfType(events, 'specialAwarded')[0]!.playerId).toBe('p2');
  });

  it("l'excédent de dégâts ne compte pas", () => {
    const state = newGame();
    setBoard(state, ['loup-garou', 'golem', 'golem'], ['momie']);
    state.board[0]!.damage = 4;
    give(state, 'p1', { coins: 3 });
    // p1 inflige 5 dont 4 perdus ; p2 inflige 2.
    const { events } = playRound(state, ORDER, { p1: lame(0, 3), p2: lame(1), p3: lame(1) });
    expect(eventsOfType(events, 'specialAwarded')[0]!.playerId).toBe('p2');
  });

  it("personne ne gagne de carte si personne n'a infligé de dégâts, ou si la pioche est vide", () => {
    const state = newGame();
    setBoard(state, [null, 'golem', null]);
    const none = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: lame(2) });
    expect(eventsOfType(none.events, 'specialAwarded')).toEqual([]);

    none.state.specialDeck = [];
    const empty = playRound(none.state, ORDER, { p1: lame(1), p2: lame(0), p3: lame(2) });
    expect(eventsOfType(empty.events, 'specialDeckEmpty')).toHaveLength(1);
  });

  it('les pièces non dépensées se conservent (+1 par manche)', () => {
    let state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    for (let i = 0; i < 3; i++) state = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: lame(0) }).state;
    expect(state.round.number).toBe(4);
    expect(state.players.map((p) => p.coins)).toEqual([4, 4, 4]);
  });
});

describe('mode Équipe', () => {
  const TEAMS = ['A', 'A', 'A', 'B', 'B', undefined];
  const ORDER6 = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

  it('met les PV en commun et donne la Spéciale au membre qui a tué un monstre', () => {
    const state = newGame(6, { teams: TEAMS });
    setBoard(state, ['loup-garou', 'golem', 'golem'], ['momie']);
    state.board[0]!.damage = 3;
    give(state, 'p1', { equipment: ['charge-abomination'] });
    const { state: after, events } = playRound(state, ORDER6, {
      p1: { equipment: { card: 'charge-abomination', slot: 1 }, boost: 0 }, // 6 dégâts
      p2: lame(0), // tue le loup-garou (2 dégâts)
      p3: lame(1),
      p4: lame(1),
      p5: lame(1),
      p6: lame(2),
    });
    expect(scoreOf(after, 'p1')).toBe(5);
    expect(scoreOf(after, 'p3')).toBe(5);
    expect(eventsOfType(events, 'specialAwarded')[0]).toMatchObject({ playerId: 'p2', sideId: 'team:A' });
  });

  it("sans tueur dans l'équipe, la Spéciale va au membre qui a fait le plus de dégâts", () => {
    const state = newGame(6, { teams: TEAMS });
    setBoard(state, ['golem', 'golem', 'golem']);
    give(state, 'p5', { coins: 1 });
    const { events } = playRound(state, ORDER6, {
      p1: lame(0),
      p2: lame(0),
      p3: lame(0),
      p4: lame(1, 1),
      p5: lame(1, 2), // équipe B : 3 + 4 = 7 > 6 pour l'équipe A
      p6: lame(2),
    });
    expect(eventsOfType(events, 'specialAwarded')[0]).toMatchObject({ playerId: 'p5', sideId: 'team:B' });
  });
});
