import { describe, expect, it } from 'vitest';
import type { Plan } from '../src/types.ts';
import { damageAt, eventsOfType, give, lame, newGame, playRound, scoreOf, setBoard } from './helpers.ts';

const ORDER = ['p1', 'p2', 'p3'];
const BIG = ['golem', 'golem', 'golem'] as const;

/** Joue une manche où p1 utilise `plan` et les autres attaquent l'emplacement 2 (sauf indication contraire). */
function p1Plays(plan: Plan, setup?: (s: ReturnType<typeof newGame>) => void, others: Partial<Record<string, Plan>> = {}) {
  const state = newGame();
  setBoard(state, [...BIG], ['momie']);
  setup?.(state);
  return playRound(state, ORDER, { p1: plan, p2: others['p2'] ?? lame(2), p3: others['p3'] ?? lame(2) });
}

describe('cartes Équipement', () => {
  it('Double griffe : 2 coups de 2 dégâts sur deux cibles, boost sur le premier seulement', () => {
    const { state } = p1Plays({ equipment: { card: 'double-griffe', slots: [0, 1] }, boost: 1 }, (s) =>
      give(s, 'p1', { equipment: ['double-griffe'], coins: 1 }),
    );
    expect(damageAt(state, 0)).toBe(3);
    expect(damageAt(state, 1)).toBe(2);
  });

  it('Double griffe sur la même cible : le second coup frappe le remplaçant si le premier tue', () => {
    const { state } = p1Plays({ equipment: { card: 'double-griffe', slots: [0, 0] }, boost: 0 }, (s) => {
      setBoard(s, ['loup-garou', 'golem', 'golem'], ['momie']);
      s.board[0]!.damage = 3;
      give(s, 'p1', { equipment: ['double-griffe'] });
    });
    expect(scoreOf(state, 'p1')).toBe(5);
    expect(state.board[0]).toMatchObject({ id: 'momie', damage: 2 });
  });

  it('Poison : 1 dégât, puis 2 dégâts au début des 2 manches suivantes, puis s’arrête', () => {
    let { state } = p1Plays({ equipment: { card: 'poison', slot: 0 }, boost: 0 }, (s) => give(s, 'p1', { equipment: ['poison'] }));
    // Manche 2 déjà commencée : 1 + 2.
    expect(damageAt(state, 0)).toBe(3);
    expect(state.board[0]!.poisons).toEqual([{ ownerId: 'p1', ticksLeft: 1 }]);
    expect(state.round.damage['p1']).toBe(2);

    state = playRound(state, ORDER, { p1: lame(1), p2: lame(2), p3: lame(2) }).state;
    expect(damageAt(state, 0)).toBe(5);
    expect(state.board[0]!.poisons).toEqual([]);

    state = playRound(state, ORDER, { p1: lame(1), p2: lame(2), p3: lame(2) }).state;
    expect(damageAt(state, 0)).toBe(5);
  });

  it('Poison : le coup fatal par poison compte pour l’empoisonneur, et le poison ne passe pas au remplaçant', () => {
    const { state, events } = p1Plays({ equipment: { card: 'poison', slot: 0 }, boost: 0 }, (s) => {
      setBoard(s, ['momie', 'golem', 'golem'], ['zombie']);
      s.board[0]!.damage = 5;
      give(s, 'p1', { equipment: ['poison'] });
    });
    expect(scoreOf(state, 'p1')).toBe(7);
    expect(state.players[0]!.equipment).toContain('poison');
    expect(state.board[0]).toMatchObject({ id: 'zombie', damage: 0, poisons: [] });
    expect(state.round.killers).toEqual(['p1']);
    expect(eventsOfType(events, 'monsterKilled')[0]!.playerId).toBe('p1');
  });

  it('Souffle de glace : 3 dégâts, et la prochaine attaque directe inflige +2', () => {
    const { state, events } = p1Plays(
      { equipment: { card: 'souffle-de-glace', slot: 0 }, boost: 0 },
      (s) => give(s, 'p1', { equipment: ['souffle-de-glace'] }),
      { p2: lame(0), p3: lame(0) },
    );
    // 3 (souffle) + 4 (lame gelée) + 2 (lame normale).
    expect(damageAt(state, 0)).toBe(9);
    expect(state.board[0]!.frozen).toBe(false);
    expect(eventsOfType(events, 'monsterFrozen')).toHaveLength(1);
  });

  it('Citrouille explosive : 3 dégâts à la cible, 1 aux voisins', () => {
    const center = p1Plays({ equipment: { card: 'citrouille-explosive', slot: 1 }, boost: 0 }, (s) =>
      give(s, 'p1', { equipment: ['citrouille-explosive'] }),
    ).state;
    expect([damageAt(center, 0), damageAt(center, 1), damageAt(center, 2)]).toEqual([1, 3, 1 + 4]);

    const edge = p1Plays(
      { equipment: { card: 'citrouille-explosive', slot: 0 }, boost: 0 },
      (s) => give(s, 'p1', { equipment: ['citrouille-explosive'] }),
      { p2: lame(1), p3: lame(1) },
    ).state;
    expect([damageAt(edge, 0), damageAt(edge, 1), damageAt(edge, 2)]).toEqual([3, 5, 0]);
  });

  it("Charge de l'abomination : 6 dégâts", () => {
    const { state } = p1Plays({ equipment: { card: 'charge-abomination', slot: 0 }, boost: 0 }, (s) =>
      give(s, 'p1', { equipment: ['charge-abomination'] }),
    );
    expect(damageAt(state, 0)).toBe(6);
  });

  it('Morsure : 3 dégâts et +1 pièce', () => {
    const { state } = p1Plays({ equipment: { card: 'morsure', slot: 0 }, boost: 0 }, (s) => give(s, 'p1', { equipment: ['morsure'] }));
    expect(damageAt(state, 0)).toBe(3);
    // 1 pièce de départ + 1 morsure + 1 de la nouvelle manche.
    expect(state.players[0]!.coins).toBe(3);
  });

  it("Envoûtement : l'attaque du joueur visé frappe l'emplacement choisi", () => {
    const { state, events } = p1Plays(
      { equipment: { card: 'envoutement', targetPlayerId: 'p3', slot: 0 }, boost: 0 },
      (s) => give(s, 'p1', { equipment: ['envoutement', 'double-griffe'] }),
      { p3: { equipment: { card: 'lame-du-chasseur', slot: 2 }, boost: 0 } },
    );
    expect(damageAt(state, 0)).toBe(2);
    expect(damageAt(state, 2)).toBe(2);
    expect(eventsOfType(events, 'actionRevealed').find((e) => e.playerId === 'p3')!.redirectedTo).toBe(0);
  });
});

describe('cartes Spéciales', () => {
  it("Sceau d'annulation : annule l'action du joueur visé, qui perd quand même ses cartes et son boost", () => {
    const { state, events } = p1Plays(
      { ...lame(0), special: { card: 'sceau-annulation', targetPlayerId: 'p2' } },
      (s) => {
        give(s, 'p1', { specials: ['sceau-annulation'] });
        give(s, 'p2', { equipment: ['charge-abomination'], coins: 1 });
      },
      { p2: { equipment: { card: 'charge-abomination', slot: 1 }, boost: 1 } },
    );
    expect(damageAt(state, 1)).toBe(0);
    expect(state.players[1]!.equipment).toEqual(['lame-du-chasseur']);
    // 1 + 1 donnée - 1 de boost payé + 1 de la nouvelle manche.
    expect(state.players[1]!.coins).toBe(2);
    expect(eventsOfType(events, 'actionCancelled')).toEqual([{ type: 'actionCancelled', playerId: 'p2', byPlayerId: 'p1' }]);
  });

  it("Sceau d'annulation : un joueur annulé avant son tour ne peut plus annuler", () => {
    const { events } = p1Plays(
      { ...lame(0), special: { card: 'sceau-annulation', targetPlayerId: 'p2' } },
      (s) => {
        give(s, 'p1', { specials: ['sceau-annulation'] });
        give(s, 'p2', { specials: ['sceau-annulation'] });
      },
      { p2: { ...lame(1), special: { card: 'sceau-annulation', targetPlayerId: 'p1' } } },
    );
    expect(eventsOfType(events, 'actionCancelled').map((e) => e.playerId)).toEqual(['p2']);
  });

  it('Bouclier du héros : bloque le premier effet qui vise le joueur, pas le second', () => {
    const state = newGame();
    setBoard(state, [...BIG]);
    give(state, 'p1', { specials: ['sceau-annulation'] });
    give(state, 'p2', { equipment: ['envoutement'] });
    give(state, 'p3', { specials: ['bouclier-du-heros'] });
    const { state: after, events } = playRound(state, ORDER, {
      p1: { ...lame(0), special: { card: 'sceau-annulation', targetPlayerId: 'p3' } },
      p2: { equipment: { card: 'envoutement', targetPlayerId: 'p3', slot: 0 }, boost: 0 },
      p3: { ...lame(2), special: { card: 'bouclier-du-heros' } },
    });
    expect(eventsOfType(events, 'effectBlocked')).toEqual([
      { type: 'effectBlocked', playerId: 'p3', sourcePlayerId: 'p1', card: 'sceau-annulation' },
    ]);
    // L'Envoûtement passe : p3 frappe l'emplacement 0.
    expect(damageAt(after, 0)).toBe(4);
    expect(damageAt(after, 2)).toBe(0);
  });

  it('Bouclier du héros : ne protège que pendant la manche où il est joué', () => {
    let state = newGame();
    setBoard(state, [...BIG]);
    give(state, 'p3', { specials: ['bouclier-du-heros'] });
    give(state, 'p1', { specials: ['sceau-annulation'] });
    state = playRound(state, ORDER, { p1: lame(0), p2: lame(0), p3: { ...lame(2), special: { card: 'bouclier-du-heros' } } }).state;
    const { events } = playRound(state, ORDER, {
      p1: { ...lame(0), special: { card: 'sceau-annulation', targetPlayerId: 'p3' } },
      p2: lame(0),
      p3: lame(2),
    });
    expect(eventsOfType(events, 'actionCancelled').map((e) => e.playerId)).toEqual(['p3']);
  });

  it("L'échange macabre : échange sa place avec le premier joueur", () => {
    const { state, events } = p1Plays(lame(1), (s) => give(s, 'p3', { specials: ['echange-macabre'] }), {
      p3: { ...lame(1), special: { card: 'echange-macabre' } },
    });
    expect(eventsOfType(events, 'orderSwapped')[0]!.order).toEqual(['p3', 'p2', 'p1']);
    expect(eventsOfType(events, 'actionRevealed').map((e) => e.playerId)).toEqual(['p3', 'p2', 'p1']);
    expect(state.round.order).toEqual([]); // nouvelle manche
  });

  it('Marque du chasseur : +3 PV si l’attaque touche un monstre, même sans le tuer', () => {
    const { state } = p1Plays({ ...lame(0), special: { card: 'marque-du-chasseur' } }, (s) =>
      give(s, 'p1', { specials: ['marque-du-chasseur'] }),
    );
    expect(scoreOf(state, 'p1')).toBe(3);

    const lost = p1Plays({ ...lame(0), special: { card: 'marque-du-chasseur' } }, (s) => {
      setBoard(s, [null, 'golem', 'golem']);
      give(s, 'p1', { specials: ['marque-du-chasseur'] });
    }).state;
    expect(scoreOf(lost, 'p1')).toBe(0);
  });

  it('Le filet magique : le tueur gagne les PV, le poseur du filet récupère les Équipements', () => {
    const { state, events } = p1Plays(
      { ...lame(1), special: { card: 'filet-magique', slot: 0 } },
      (s) => {
        setBoard(s, ['yeti', 'golem', 'golem'], ['momie']);
        s.board[0]!.damage = 8;
        give(s, 'p1', { specials: ['filet-magique'] });
      },
      { p2: lame(0) },
    );
    expect(scoreOf(state, 'p2')).toBe(10);
    expect(state.players[0]!.equipment).toEqual(['lame-du-chasseur', 'souffle-de-glace', 'double-griffe']);
    expect(state.players[1]!.equipment).toEqual(['lame-du-chasseur']);
    expect(eventsOfType(events, 'monsterKilled')[0]).toMatchObject({ playerId: 'p2', rewardsTo: 'p1' });
  });

  it('Vague de choc : 2 dégâts à tous les monstres, coups fatals attribués au lanceur', () => {
    const { state } = p1Plays({ special: { card: 'vague-de-choc' }, boost: 0 }, (s) => {
      setBoard(s, ['loup-garou', 'golem', 'golem'], ['momie']);
      s.board[0]!.damage = 3;
      give(s, 'p1', { specials: ['vague-de-choc'] });
    });
    expect(scoreOf(state, 'p1')).toBe(5);
    expect(state.board[0]).toMatchObject({ id: 'momie', damage: 0 });
    expect(damageAt(state, 1)).toBe(2);
    expect(damageAt(state, 2)).toBe(2 + 4);
  });
});
