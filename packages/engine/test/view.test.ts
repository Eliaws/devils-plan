import { describe, expect, it } from 'vitest';
import { eventsFor, viewFor } from '../src/index.ts';
import { act, biddingInOrder, give, lame, newGame, playRound, setBoard } from './helpers.ts';

describe('vues filtrées (informations secrètes)', () => {
  it("ne montre que sa propre main et celle de ses coéquipiers", () => {
    const state = newGame(6, { teams: ['A', 'A', 'B', 'B', undefined, undefined] });
    give(state, 'p3', { equipment: ['poison'], specials: ['vague-de-choc'] });
    const view = viewFor(state, { kind: 'player', playerId: 'p4' });

    expect(view.players[2]!.equipment).toEqual(['lame-du-chasseur', 'poison']);
    expect(view.players[3]!.specials).toEqual([]);
    expect(view.players[0]!.equipment).toBeNull();
    expect(view.players[0]!.equipmentCount).toBe(1);
    expect(viewFor(state, { kind: 'table' }).players.every((p) => p.equipment === null)).toBe(true);
  });

  it('cache les mises jusqu’à leur révélation', () => {
    let state = newGame();
    state = act(state, { type: 'bid', playerId: 'p1', amount: 1 }).state;
    const hidden = viewFor(state, { kind: 'player', playerId: 'p2' });
    expect(hidden.players[0]).toMatchObject({ hasBid: true, bid: null });
    expect(viewFor(state, { kind: 'player', playerId: 'p1' }).players[0]!.bid).toBe(1);

    state = act(state, { type: 'bid', playerId: 'p2', amount: 0 }).state;
    state = act(state, { type: 'bid', playerId: 'p3', amount: 0 }).state;
    expect(viewFor(state, { kind: 'player', playerId: 'p2' }).players[0]!.bid).toBe(1);
  });

  it('cache les plans adverses et les PV restants des monstres', () => {
    let state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    state.board[0]!.damage = 7;
    state = biddingInOrder(state, ['p1', 'p2', 'p3']).state;
    state = act(state, { type: 'plan', playerId: 'p1', plan: lame(2) }).state;

    const view = viewFor(state, { kind: 'player', playerId: 'p2' });
    expect(view.players[0]).toMatchObject({ hasPlanned: true, plan: null });
    expect(view.board[0]).toEqual({ id: 'golem', maxHp: 18, frozen: false, poisoned: false, netOwnerId: null });
    expect(JSON.stringify(view)).not.toContain('"damage"');
  });

  it("ne transmet le rapport de L'éclaireur qu'à son utilisateur", () => {
    let state = newGame();
    give(state, 'p1', { specials: ['eclaireur'] });
    state = biddingInOrder(state, ['p1', 'p2', 'p3']).state;
    const { state: after, events } = act(state, { type: 'scout', playerId: 'p1' });

    expect(viewFor(after, { kind: 'player', playerId: 'p1' }).scouted).toHaveLength(3);
    expect(viewFor(after, { kind: 'player', playerId: 'p2' }).scouted).toBeNull();
    expect(eventsFor(after, events, { kind: 'player', playerId: 'p1' })).toHaveLength(1);
    expect(eventsFor(after, events, { kind: 'player', playerId: 'p2' })).toEqual([]);
    expect(eventsFor(after, events, { kind: 'table' })).toEqual([]);
  });

  it('retire le montant des dégâts et la carte Spéciale gagnée par un autre', () => {
    const state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    give(state, 'p1', { coins: 1 });
    const { state: after, events } = playRound(state, ['p1', 'p2', 'p3'], { p1: lame(0, 1), p2: lame(1), p3: lame(2) });

    const forP2 = eventsFor(after, events, { kind: 'player', playerId: 'p2' });
    expect(forP2.filter((e) => e.type === 'monsterHit').every((e) => e.amount === null)).toBe(true);
    expect(forP2.find((e) => e.type === 'specialAwarded')).toMatchObject({ playerId: 'p1', card: null });
    const forP1 = eventsFor(after, events, { kind: 'player', playerId: 'p1' });
    expect(forP1.find((e) => e.type === 'specialAwarded')).toMatchObject({ card: after.players[0]!.specials[0] });
    // L'état d'origine n'est pas modifié par le filtrage.
    expect(events.find((e) => e.type === 'monsterHit')).toMatchObject({ amount: 3 });
  });
});
