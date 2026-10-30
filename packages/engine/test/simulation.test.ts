import { describe, expect, it } from 'vitest';
import {
  apply,
  CARD_SETS,
  type CardSet,
  MONSTER_IDS,
  MONSTERS,
  SLOTS,
  type SlotIndex,
  waitingPlayers,
} from '../src/index.ts';
import { type RngHolder, randomInt } from '../src/rng.ts';
import type { EquipmentPlay, GameEvent, GameState, Plan, PlayerState, SpecialPlay } from '../src/types.ts';
import { newGame } from './helpers.ts';

// Parties complètes jouées par des joueurs aléatoires (mais légaux),
// en vérifiant les invariants après chaque action.

const pick = <T>(rng: RngHolder, items: readonly T[]): T => items[randomInt(rng, items.length)]!;
const slot = (rng: RngHolder): SlotIndex => pick(rng, SLOTS);

function randomPlan(rng: RngHolder, state: GameState, player: PlayerState, scouted: boolean): Plan {
  const others = state.players.filter((p) => p.id !== player.id).map((p) => p.id);
  const card = pick(rng, player.equipment);
  let equipment: EquipmentPlay;
  if (card === 'double-griffe') equipment = { card, slots: [slot(rng), slot(rng)] };
  else if (card === 'envoutement')
    equipment =
      state.cardSet === 'classiques'
        ? { card, targetPlayerId: pick(rng, others), slot: slot(rng) }
        : { card, slot: slot(rng) };
  else equipment = { card, slot: slot(rng) };

  let special: SpecialPlay | undefined;
  const playable = player.specials.filter((s) => s !== 'eclaireur');
  if (!scouted && playable.length > 0 && randomInt(rng, 2) === 0) {
    const s = pick(rng, playable);
    if (s === 'sceau-annulation') special = { card: s, targetPlayerId: pick(rng, others) };
    else if (s === 'filet-magique') special = { card: s, slot: slot(rng) };
    else if (s === 'marque-du-chasseur' || s === 'poing-infernal')
      special = card === 'envoutement' ? undefined : { card: s };
    else special = { card: s };
  }

  const boost = card === 'envoutement' ? 0 : randomInt(rng, player.coins + 1);
  return { equipment, ...(special ? { special } : {}), boost };
}

function checkInvariants(state: GameState, markPoints: number): void {
  for (const p of state.players) expect(p.coins).toBeGreaterThanOrEqual(0);

  const monsters = [...state.board.flatMap((m) => (m ? [m.id] : [])), ...state.monsterDeck, ...state.defeatedMonsters];
  expect(monsters.sort()).toEqual([...MONSTER_IDS].sort());
  for (const m of state.board) if (m) expect(m.damage).toBeLessThan(MONSTERS[m.id].hp);

  const heldEquipment = state.players.flatMap((p) => p.equipment.filter((c) => c !== 'lame-du-chasseur'));
  expect(heldEquipment.length + state.equipmentReserve.length + state.equipmentDiscard.length).toBe(16);
  for (const p of state.players) expect(p.equipment.filter((c) => c === 'lame-du-chasseur')).toHaveLength(1);

  const heldSpecials = state.players.flatMap((p) => p.specials);
  expect(heldSpecials.length + state.specialDeck.length + state.specialDiscard.length).toBe(16);

  const totalScore = state.sides.reduce((sum, s) => sum + s.score, 0);
  const defeatedHp = state.defeatedMonsters.reduce((sum, id) => sum + MONSTERS[id].hp, 0);
  expect(totalScore).toBe(defeatedHp + markPoints);
}

function playRandomGame(
  seed: number,
  playerCount: number,
  cardSet: CardSet,
  teams?: (string | undefined)[],
  withAbsences = false,
) {
  let state = newGame(playerCount, { seed, cardSet, ...(teams ? { teams } : {}) });
  const rng: RngHolder = { rng: seed * 7919 };
  const allEvents: GameEvent[] = [];
  let markPoints = 0;
  let actions = 0;

  const step = (action: Parameters<typeof apply>[1]) => {
    const result = apply(state, action);
    if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message} (${JSON.stringify(action)})`);
    state = result.state;
    allEvents.push(...result.events);
    for (const e of result.events) if (e.type === 'hunterMarked') markPoints += e.points;
    checkInvariants(state, markPoints);
    actions++;
  };

  while (state.phase !== 'gameOver') {
    expect(state.round.number).toBeLessThan(150);
    // De temps en temps, un joueur part ou revient (au moins un joueur reste toujours présent).
    if (withAbsences && randomInt(rng, 6) === 0) {
      const player = pick(rng, state.players);
      const absent = state.absent.includes(player.id);
      if (absent) step({ type: 'rejoin', playerId: player.id });
      else if (state.absent.length < state.players.length - 1) step({ type: 'leave', playerId: player.id });
      continue;
    }
    const next = waitingPlayers(state)[0];
    if (next === undefined) throw new Error('Partie bloquée : personne à attendre');
    if (state.phase === 'bidding') {
      const player = state.players.find((p) => p.id === next)!;
      step({ type: 'bid', playerId: next, amount: randomInt(rng, player.coins + 1) });
    } else if (state.phase === 'recap') {
      step({ type: 'ready', playerId: next });
    } else {
      const player = state.players.find((p) => p.id === next)!;
      const scouted = player.specials.includes('eclaireur') && !state.round.scouted[next] && randomInt(rng, 3) === 0;
      if (scouted) step({ type: 'scout', playerId: next });
      const current = state.players.find((p) => p.id === next)!;
      step({
        type: 'plan',
        playerId: next,
        plan: randomPlan(rng, state, current, scouted || !!state.round.scouted[next]),
      });
    }
  }
  return { state, events: allEvents, actions };
}

describe.each(CARD_SETS)('parties simulées (cartes %s)', (cardSet) => {
  it.each([3, 4, 5])('%i joueurs solo : 20 parties vont jusqu’au bout en respectant les règles', (players) => {
    for (let seed = 1; seed <= 20; seed++) {
      const { state, events } = playRandomGame(seed, players, cardSet);
      expect(state.phase).toBe('gameOver');
      expect(state.defeatedMonsters).toContain('la-faucheuse');
      expect(state.result!.winners.length).toBeGreaterThan(0);
      expect(events.filter((e) => e.type === 'gameOver')).toHaveLength(1);
    }
  });

  it('6 à 12 joueurs avec équipes : 20 parties vont jusqu’au bout', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const count = 6 + (seed % 7);
      const teams = Array.from({ length: count }, (_, i) => (i < count - 2 ? `T${Math.floor(i / 3)}` : undefined));
      const { state } = playRandomGame(seed, count, cardSet, teams);
      expect(state.phase).toBe('gameOver');
      expect(state.sides.filter((s) => s.isTeam).every((s) => s.playerIds.length <= 3)).toBe(true);
    }
  });

  it('20 parties avec des joueurs qui partent et reviennent vont jusqu’au bout', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { state } = playRandomGame(seed, 3 + (seed % 4), cardSet, undefined, true);
      expect(state.phase).toBe('gameOver');
    }
  });

  it('rejoue exactement la même partie avec la même graine', () => {
    const a = playRandomGame(123, 4, cardSet);
    const b = playRandomGame(123, 4, cardSet);
    expect(b.state).toEqual(a.state);
    expect(b.events).toEqual(a.events);
  });
});

it("ne modifie jamais l'état reçu", () => {
  const state = newGame();
  const snapshot = structuredClone(state);
  apply(state, { type: 'bid', playerId: 'p1', amount: 1 });
  expect(state).toEqual(snapshot);
});
