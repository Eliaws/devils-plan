import { describe, expect, it } from 'vitest';
import { act, biddingInOrder, eventsOfType, expectRejected, give, lame, newGame, setBoard } from './helpers.ts';

describe('mises et ordre de passage', () => {
  it('ordonne par mise décroissante et fait payer tout le monde', () => {
    let state = newGame();
    give(state, 'p1', { coins: 2 });
    state = act(state, { type: 'bid', playerId: 'p1', amount: 1 }).state;
    state = act(state, { type: 'bid', playerId: 'p2', amount: 0 }).state;
    expect(state.phase).toBe('bidding');
    const { state: after, events } = act(state, { type: 'bid', playerId: 'p3', amount: 1 });

    expect(after.phase).toBe('planning');
    expect(after.round.order[2]).toBe('p2');
    expect(after.players.map((p) => p.coins)).toEqual([2, 1, 0]);
    expect(eventsOfType(events, 'bidsRevealed')[0]!.bids).toEqual({ p1: 1, p2: 0, p3: 1 });
  });

  it('départage les égalités au hasard (mais de façon reproductible)', () => {
    const firstPlayers = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      let state = newGame(3, { seed });
      for (const id of ['p1', 'p2', 'p3']) state = act(state, { type: 'bid', playerId: id, amount: 0 }).state;
      firstPlayers.add(state.round.order[0]!);
    }
    expect(firstPlayers.size).toBe(3);
  });

  it('permet de changer sa mise tant que tout le monde n’a pas misé', () => {
    let state = newGame();
    state = act(state, { type: 'bid', playerId: 'p1', amount: 1 }).state;
    state = act(state, { type: 'bid', playerId: 'p1', amount: 0 }).state;
    expect(state.round.bids['p1']).toBe(0);
  });

  it('refuse les mises invalides', () => {
    const state = newGame();
    expectRejected(state, { type: 'bid', playerId: 'p1', amount: 2 }, 'NOT_ENOUGH_COINS');
    expectRejected(state, { type: 'bid', playerId: 'p1', amount: -1 }, 'INVALID_AMOUNT');
    expectRejected(state, { type: 'bid', playerId: 'p1', amount: 0.5 }, 'INVALID_AMOUNT');
    expectRejected(state, { type: 'bid', playerId: 'inconnu', amount: 0 }, 'UNKNOWN_PLAYER');
    expectRejected(state, { type: 'plan', playerId: 'p1', plan: lame(0) }, 'WRONG_PHASE');
  });
});

describe('planification', () => {
  const planning = () => biddingInOrder(newGame(), ['p1', 'p2', 'p3']).state;

  it('attend tous les plans avant de résoudre, et accepte un plan modifié', () => {
    let state = planning();
    state = act(state, { type: 'plan', playerId: 'p1', plan: lame(0) }).state;
    state = act(state, { type: 'plan', playerId: 'p1', plan: lame(1) }).state;
    state = act(state, { type: 'plan', playerId: 'p2', plan: lame(0) }).state;
    expect(state.phase).toBe('planning');
    expect(state.round.plans['p1']).toEqual(lame(1));
    const { state: after } = act(state, { type: 'plan', playerId: 'p3', plan: lame(0) });
    expect(after.round.number).toBe(2);
    expect(after.phase).toBe('bidding');
  });

  it('refuse les plans invalides', () => {
    const state = planning();
    give(state, 'p1', { equipment: ['envoutement'] });
    const reject = (plan: object, code: string) =>
      expectRejected(state, { type: 'plan', playerId: 'p1', plan: plan as never }, code);

    reject({ boost: 0 }, 'NO_CARD_PLAYED');
    reject({ equipment: { card: 'poison', slot: 0 }, boost: 0 }, 'CARD_NOT_IN_HAND');
    reject({ special: { card: 'vague-de-choc' }, boost: 0 }, 'CARD_NOT_IN_HAND');
    reject({ equipment: { card: 'lame-du-chasseur', slot: 3 }, boost: 0 }, 'INVALID_SLOT');
    reject({ equipment: { card: 'envoutement', targetPlayerId: 'p1', slot: 0 }, boost: 0 }, 'INVALID_TARGET');
    reject({ equipment: { card: 'envoutement', targetPlayerId: 'zz', slot: 0 }, boost: 0 }, 'UNKNOWN_PLAYER');
    reject({ equipment: { card: 'envoutement', targetPlayerId: 'p2', slot: 0 }, boost: 1 }, 'BOOST_NEEDS_ATTACK');
    reject({ ...lame(0), boost: 99 }, 'NOT_ENOUGH_COINS');
  });

  it('exige une attaque pour la Marque du chasseur et refuse L’éclaireur dans un plan', () => {
    const state = planning();
    give(state, 'p1', { equipment: ['envoutement'], specials: ['marque-du-chasseur', 'eclaireur'] });
    expectRejected(
      state,
      { type: 'plan', playerId: 'p1', plan: { special: { card: 'marque-du-chasseur' }, boost: 0 } },
      'MARK_NEEDS_ATTACK',
    );
    expectRejected(
      state,
      {
        type: 'plan',
        playerId: 'p1',
        plan: { equipment: { card: 'envoutement', targetPlayerId: 'p2', slot: 0 }, special: { card: 'marque-du-chasseur' }, boost: 0 },
      },
      'MARK_NEEDS_ATTACK',
    );
    expectRejected(state, { type: 'plan', playerId: 'p1', plan: { special: { card: 'eclaireur' } as never, boost: 0 } }, 'INVALID_CARD');
  });
});

describe("L'éclaireur", () => {
  it('révèle immédiatement les PV restants au seul joueur, et compte comme sa Spéciale', () => {
    let state = newGame();
    setBoard(state, ['loup-garou', 'golem', null]);
    state.board[1]!.damage = 4;
    give(state, 'p1', { specials: ['eclaireur', 'vague-de-choc'] });
    state = biddingInOrder(state, ['p1', 'p2', 'p3']).state;

    const { state: after, events } = act(state, { type: 'scout', playerId: 'p1' });
    expect(eventsOfType(events, 'scouted')[0]!.report).toEqual([
      { slot: 0, monsterId: 'loup-garou', hpRemaining: 5 },
      { slot: 1, monsterId: 'golem', hpRemaining: 14 },
    ]);
    expect(after.players[0]!.specials).toEqual(['vague-de-choc']);
    expect(after.specialDiscard).toEqual(['eclaireur']);

    expectRejected(after, { type: 'scout', playerId: 'p1' }, 'SPECIAL_ALREADY_USED');
    expectRejected(after, { type: 'plan', playerId: 'p1', plan: { ...lame(0), special: { card: 'vague-de-choc' } } }, 'SPECIAL_ALREADY_USED');
    // Après L'éclaireur, un plan sans carte est accepté.
    expect(act(after, { type: 'plan', playerId: 'p1', plan: { boost: 0 } }).state.round.plans['p1']).toEqual({ boost: 0 });
  });

  it('est refusé sans la carte ou si le plan contient déjà une Spéciale', () => {
    const state = biddingInOrder(newGame(), ['p1', 'p2', 'p3']).state;
    expectRejected(state, { type: 'scout', playerId: 'p1' }, 'CARD_NOT_IN_HAND');
    give(state, 'p2', { specials: ['eclaireur', 'vague-de-choc'] });
    const planned = act(state, { type: 'plan', playerId: 'p2', plan: { special: { card: 'vague-de-choc' }, boost: 0 } }).state;
    expectRejected(planned, { type: 'scout', playerId: 'p2' }, 'SPECIAL_ALREADY_USED');
  });
});
