import { describe, expect, it } from 'vitest';
import { damageAt, eventsOfType, give, lame, newGame, playRound, scoreOf, setBoard } from './helpers.ts';

const ORDER = ['p1', 'p2', 'p3'];

describe('résolution des attaques', () => {
  it('inflige les dégâts dans l’ordre de passage', () => {
    const state = newGame();
    setBoard(state, ['golem', 'vampire', 'sirene'], ['momie']);
    const { state: after, events } = playRound(state, ORDER, { p1: lame(0), p2: lame(1), p3: lame(0) });
    expect(damageAt(after, 0)).toBe(4);
    expect(damageAt(after, 1)).toBe(2);
    expect(eventsOfType(events, 'actionRevealed').map((e) => e.playerId)).toEqual(ORDER);
  });

  it('le coup fatal rapporte les PV au camp et les Équipements au tueur, puis le monstre est remplacé', () => {
    const state = newGame();
    setBoard(state, ['loup-garou', 'golem', 'golem'], ['momie']);
    state.board[0]!.damage = 4;
    const { state: after, events } = playRound(state, ORDER, { p1: lame(1), p2: lame(0), p3: lame(1) });

    expect(scoreOf(after, 'p2')).toBe(5);
    expect(after.players[1]!.equipment).toEqual(['lame-du-chasseur', 'double-griffe']);
    expect(after.players[1]!.kills).toBe(1);
    expect(after.equipmentReserve.filter((c) => c === 'double-griffe')).toHaveLength(3);
    expect(after.board[0]).toMatchObject({ id: 'momie', damage: 0 });
    expect(after.defeatedMonsters).toEqual(['loup-garou']);
    // Excédent perdu : seul 1 dégât compte.
    expect(eventsOfType(events, 'monsterHit').find((e) => e.playerId === 'p2')!.amount).toBe(1);
    expect(eventsOfType(events, 'monsterRevealed')).toEqual([{ type: 'monsterRevealed', slot: 0, monsterId: 'momie' }]);
  });

  it('une attaque sur un monstre mort frappe son remplaçant', () => {
    const state = newGame();
    setBoard(state, ['loup-garou', 'golem', 'golem'], ['momie']);
    state.board[0]!.damage = 3;
    const { state: after } = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: lame(1) });
    expect(scoreOf(after, 'p1')).toBe(5);
    expect(after.board[0]).toMatchObject({ id: 'momie', damage: 2 });
  });

  it("l'attaque est perdue si l'emplacement est vide (pioche épuisée)", () => {
    const state = newGame();
    setBoard(state, ['loup-garou', 'golem', null]);
    state.board[0]!.damage = 3;
    const { state: after, events } = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: lame(2) });
    expect(after.board[0]).toBeNull();
    expect(eventsOfType(events, 'attackLost').map((e) => e.playerId)).toEqual(['p2', 'p3']);
  });

  it('le boost ajoute 1 dégât par pièce et coûte les pièces', () => {
    const state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    give(state, 'p1', { coins: 2 });
    const { state: after } = playRound(state, ORDER, { p1: lame(0, 3), p2: lame(1), p3: lame(2) });
    expect(damageAt(after, 0)).toBe(5);
    // 1 + 2 pièces - 3 de boost + 1 pièce de la nouvelle manche.
    expect(after.players[0]!.coins).toBe(1);
  });

  it('défausse les Équipements joués, sauf la Lame qui revient en main', () => {
    const state = newGame();
    setBoard(state, ['golem', 'golem', 'golem']);
    give(state, 'p1', { equipment: ['charge-abomination'] });
    const { state: after } = playRound(state, ORDER, {
      p1: { equipment: { card: 'charge-abomination', slot: 0 }, boost: 0 },
      p2: lame(1),
      p3: lame(2),
    });
    expect(after.players[0]!.equipment).toEqual(['lame-du-chasseur']);
    expect(after.players[1]!.equipment).toEqual(['lame-du-chasseur']);
    expect(after.equipmentDiscard).toEqual(['charge-abomination']);
  });
});

describe('fin de partie', () => {
  it('se termine quand tous les monstres sont morts, même en cours de manche', () => {
    const state = newGame();
    setBoard(state, ['la-faucheuse', null, 'loup-garou']);
    state.board[0]!.damage = 18;
    state.board[2]!.damage = 3;
    const { state: after, events } = playRound(state, ORDER, { p1: lame(0), p2: lame(2), p3: lame(0) });

    expect(after.phase).toBe('gameOver');
    expect(eventsOfType(events, 'actionRevealed').map((e) => e.playerId)).toEqual(['p1', 'p2']);
    expect(after.result!.ranking.map((r) => [r.sideId, r.score, r.rank])).toEqual([
      ['solo:p1', 20, 1],
      ['solo:p2', 5, 2],
      ['solo:p3', 0, 3],
    ]);
    expect(after.result!.winners).toEqual(['solo:p1']);
  });

  it('départage les égalités de PV par le nombre de monstres tués, puis partage la victoire', () => {
    const state = newGame();
    setBoard(state, ['loup-garou', null, null]);
    state.board[0]!.damage = 4;
    // Avant le dernier coup : p2 a 5 PV sans monstre tué, p3 a 5 PV et 1 monstre tué.
    Object.assign(state.sides[1]!, { score: 5, kills: 0 });
    Object.assign(state.sides[2]!, { score: 5, kills: 1 });
    const { state: after } = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: lame(0) });

    expect(after.result!.ranking.map((r) => [r.sideId, r.score, r.kills, r.rank])).toEqual([
      ['solo:p1', 5, 1, 1],
      ['solo:p3', 5, 1, 1],
      ['solo:p2', 5, 0, 3],
    ]);
    expect(after.result!.winners).toEqual(['solo:p1', 'solo:p3']);
  });
});
