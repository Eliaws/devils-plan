import { describe, expect, it } from 'vitest';
import type { MonsterId } from '../src/cards.ts';
import type { GameState, Plan } from '../src/types.ts';
import { damageAt, eventsOfType, give, lame, newGame, playRound, scoreOf, setBoard } from './helpers.ts';

// Version « cartes imprimées » : effets écrits sur les illustrations.

const ORDER = ['p1', 'p2', 'p3'];

/** Par défaut, trois Golems : pratique pour compter les dégâts (les effets qui suivent un monstre précis utilisent des monstres distincts). */
function printedGame(
  board: readonly MonsterId[] = ['golem', 'golem', 'golem'],
  deck: readonly MonsterId[] = ['momie'],
): GameState {
  const state = newGame(3, { cardSet: 'imprimees' });
  setBoard(state, [...board], [...deck]);
  return state;
}

/** p1 joue `plan`, les autres attaquent l'emplacement 2 à la Lame (sauf indication contraire). */
function round(state: GameState, p1: Plan, others: Partial<Record<string, Plan>> = {}, order = ORDER) {
  return playRound(state, order, { p1, p2: others.p2 ?? lame(2), p3: others.p3 ?? lame(2) });
}

describe('cartes imprimées : effets immédiats', () => {
  it('Lame du chasseur : 3 dégâts', () => {
    const { state } = round(printedGame(), lame(0));
    expect(damageAt(state, 0)).toBe(3);
  });

  it('Double griffe : 4 dégâts sur une seule cible, ou 2 sur deux cibles', () => {
    const single = printedGame();
    give(single, 'p1', { equipment: ['double-griffe'] });
    const one = round(single, { equipment: { card: 'double-griffe', slots: [0, 0] }, boost: 0 });
    expect(damageAt(one.state, 0)).toBe(4);
    expect(eventsOfType(one.events, 'monsterHit').filter((e) => e.playerId === 'p1')).toHaveLength(1);

    const split = printedGame();
    give(split, 'p1', { equipment: ['double-griffe'] });
    const two = round(split, { equipment: { card: 'double-griffe', slots: [0, 1] }, boost: 0 });
    expect([damageAt(two.state, 0), damageAt(two.state, 1)]).toEqual([2, 2]);
  });

  it('Citrouille explosive : 5 dégâts à la cible, rien aux voisins', () => {
    const state = printedGame();
    give(state, 'p1', { equipment: ['citrouille-explosive'] });
    const after = round(state, { equipment: { card: 'citrouille-explosive', slot: 1 }, boost: 0 }).state;
    expect([damageAt(after, 0), damageAt(after, 1)]).toEqual([0, 5]);
  });

  it('Poing infernal : +2 dégâts à une attaque', () => {
    const state = printedGame();
    give(state, 'p1', { specials: ['poing-infernal'] });
    const after = round(state, { ...lame(0), special: { card: 'poing-infernal' } }).state;
    expect(damageAt(after, 0)).toBe(5);
    expect(after.specialDiscard).toEqual(['poing-infernal']);
  });

  it('Poison : 1 dégât, puis 1 au début de chaque manche jusqu’à la mort du monstre', () => {
    let state = printedGame();
    give(state, 'p1', { equipment: ['poison'] });
    state = round(state, { equipment: { card: 'poison', slot: 0 }, boost: 0 }).state;
    expect(damageAt(state, 0)).toBe(2); // 1 immédiat + 1 au début de la manche 2
    expect(state.board[0]!.poisons).toEqual([{ ownerId: 'p1', amount: 1, ticksLeft: null }]);
    for (let i = 0; i < 3; i++) state = round(state, lame(1)).state;
    expect(damageAt(state, 0)).toBe(5);
  });
});

describe('cartes imprimées : Souffle de glace', () => {
  it('protège le monstre des autres joueurs jusqu’à la prochaine action du lanceur', () => {
    let state = printedGame();
    give(state, 'p1', { equipment: ['souffle-de-glace'] });
    const first = round(
      state,
      { equipment: { card: 'souffle-de-glace', slot: 0 }, boost: 0 },
      { p2: lame(0), p3: lame(0) },
    );
    state = first.state;
    expect(damageAt(state, 0)).toBe(3);
    expect(state.board[0]!.protectedBy).toBe('p1');
    expect(eventsOfType(first.events, 'damageBlocked').map((e) => e.playerId)).toEqual(['p2', 'p3']);

    // Manche 2 : p2 passe avant p1 (bloqué), p3 après p1 (la protection est levée).
    const second = round(state, lame(0), { p2: lame(0), p3: lame(0) }, ['p2', 'p1', 'p3']);
    expect(eventsOfType(second.events, 'damageBlocked').map((e) => e.playerId)).toEqual(['p2']);
    expect(eventsOfType(second.events, 'protectionEnded')).toHaveLength(1);
    expect(damageAt(second.state, 0)).toBe(3 + 3 + 3);
  });

  it('bloque aussi les dégâts de zone des autres joueurs', () => {
    let state = printedGame();
    give(state, 'p1', { equipment: ['souffle-de-glace'] });
    give(state, 'p2', { specials: ['vague-de-choc'] });
    state = round(
      state,
      { equipment: { card: 'souffle-de-glace', slot: 0 }, boost: 0 },
      { p2: { special: { card: 'vague-de-choc' }, boost: 0 } },
    ).state;
    expect(damageAt(state, 0)).toBe(3);
    expect(damageAt(state, 1)).toBe(2);
  });
});

describe('cartes imprimées : effets au prochain tour du joueur', () => {
  it("Charge de l'abomination : 8 dégâts à la prochaine action du joueur", () => {
    let state = printedGame();
    give(state, 'p1', { equipment: ['charge-abomination'], specials: ['poing-infernal'] });
    const first = round(state, {
      equipment: { card: 'charge-abomination', slot: 0 },
      special: { card: 'poing-infernal' },
      boost: 0,
    });
    state = first.state;
    expect(damageAt(state, 0)).toBe(0);
    expect(eventsOfType(first.events, 'effectScheduled')).toMatchObject([
      { playerId: 'p1', card: 'charge-abomination' },
    ]);
    expect(state.players[0]!.equipment).toEqual(['lame-du-chasseur']);

    const second = round(state, lame(1));
    expect(damageAt(second.state, 0)).toBe(10); // 8 + 2 du Poing infernal
    expect(eventsOfType(second.events, 'effectTriggered')).toHaveLength(1);
  });

  it('Envoûtement : le monstre meurt à la prochaine action du joueur, qui marque les PV', () => {
    let state = printedGame(['yeti', 'golem', 'golem'], ['momie']);
    give(state, 'p1', { equipment: ['envoutement'] });
    state = round(state, { equipment: { card: 'envoutement', slot: 0 }, boost: 0 }).state;
    expect(state.board[0]!.id).toBe('yeti');

    const { state: after, events } = round(state, lame(1));
    expect(scoreOf(after, 'p1')).toBe(10);
    expect(after.players[0]!.equipment).toEqual(['lame-du-chasseur', 'souffle-de-glace', 'double-griffe']);
    expect(after.board[0]!.id).toBe('momie');
    expect(eventsOfType(events, 'monsterKilled')[0]).toMatchObject({ playerId: 'p1', monsterId: 'yeti' });
  });

  it('Envoûtement : sans effet si le monstre est tué avant', () => {
    let state = printedGame(['loup-garou', 'golem', 'golem'], ['momie']);
    give(state, 'p1', { equipment: ['envoutement'] });
    state = round(state, { equipment: { card: 'envoutement', slot: 0 }, boost: 0 }, { p2: lame(0), p3: lame(0) }).state;
    expect(scoreOf(state, 'p2')).toBe(0);
    expect(scoreOf(state, 'p3')).toBe(5);
    expect(state.pending).toEqual([]);
    const { state: after } = round(state, lame(1));
    expect(after.board[0]).toMatchObject({ id: 'momie', damage: 0 });
  });

  it('Morsure : 2 dégâts, puis 2 au monstre et 2 à son voisin de gauche', () => {
    let state = printedGame(['vampire', 'golem', 'sirene']);
    give(state, 'p1', { equipment: ['morsure'] });
    state = round(state, { equipment: { card: 'morsure', slot: 1 }, boost: 0 }).state;
    expect([damageAt(state, 0), damageAt(state, 1)]).toEqual([0, 2]);

    const { state: after } = round(state, lame(2));
    expect([damageAt(after, 0), damageAt(after, 1)]).toEqual([2, 4]);
  });

  it("les effets différés se déclenchent même si l'action du joueur est annulée", () => {
    let state = printedGame();
    give(state, 'p1', { equipment: ['charge-abomination'] });
    give(state, 'p2', { specials: ['sceau-annulation'] });
    state = round(state, { equipment: { card: 'charge-abomination', slot: 0 }, boost: 0 }).state;
    const { state: after, events } = round(
      state,
      lame(0),
      {
        p2: { ...lame(2), special: { card: 'sceau-annulation', targetPlayerId: 'p1' } },
      },
      ['p2', 'p1', 'p3'],
    );
    expect(eventsOfType(events, 'actionCancelled').map((e) => e.playerId)).toEqual(['p1']);
    expect(damageAt(after, 0)).toBe(8);
  });

  it('accepte un Envoûtement sans joueur ciblé, contrairement à la version classique', () => {
    const state = printedGame();
    give(state, 'p1', { equipment: ['envoutement'] });
    expect(() => round(state, { equipment: { card: 'envoutement', slot: 0 }, boost: 0 })).not.toThrow();
  });
});
