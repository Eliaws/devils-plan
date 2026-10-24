import { expect } from 'vitest';
import type { CardSet, EquipmentId, MonsterId, SlotIndex, SpecialId } from '../src/cards.ts';
import { apply, createGame } from '../src/index.ts';
import { freshMonster, getPlayer } from '../src/state.ts';
import type { Action, GameEvent, GameState, Plan, PlayerId, PlayerSetup } from '../src/types.ts';

/** Les tests de base utilisent la version classique ; printed.test.ts couvre les cartes imprimées. */
export function newGame(
  playerCount = 3,
  options: { seed?: number; teams?: (string | undefined)[]; cardSet?: CardSet } = {},
): GameState {
  const players: PlayerSetup[] = Array.from({ length: playerCount }, (_, i) => {
    const teamId = options.teams?.[i];
    return { id: `p${i + 1}`, name: `Joueur ${i + 1}`, ...(teamId ? { teamId } : {}) };
  });
  return createGame({ players, seed: options.seed ?? 42, cardSet: options.cardSet ?? 'classiques' }).state;
}

/** Applique une action qui doit réussir. */
export function act(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  const result = apply(state, action);
  if (!result.ok) throw new Error(`Action refusée (${result.error.code}) : ${result.error.message}`);
  return { state: result.state, events: result.events };
}

/** Vérifie qu'une action est refusée avec le code attendu. */
export function expectRejected(state: GameState, action: Action, code: string): void {
  const result = apply(state, action);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

/** Place des monstres sur le plateau (null = emplacement vide) et remplace la pioche. */
export function setBoard(state: GameState, board: (MonsterId | null)[], deck: MonsterId[] = []): void {
  state.board = board.map((id) => (id ? freshMonster(id) : null));
  state.monsterDeck = [...deck];
}

export function give(
  state: GameState,
  playerId: PlayerId,
  cards: { equipment?: EquipmentId[]; specials?: SpecialId[]; coins?: number },
): void {
  const player = getPlayer(state, playerId);
  player.equipment.push(...(cards.equipment ?? []));
  player.specials.push(...(cards.specials ?? []));
  player.coins += cards.coins ?? 0;
}

/**
 * Fait miser tout le monde pour obtenir exactement l'ordre de passage demandé.
 * Les pièces nécessaires aux mises sont données puis dépensées : le solde ne change pas.
 */
export function biddingInOrder(state: GameState, order: PlayerId[]): { state: GameState; events: GameEvent[] } {
  expect([...order].sort()).toEqual(state.players.map((p) => p.id).sort());
  const events: GameEvent[] = [];
  let current = state;
  for (const [i, id] of order.entries()) give(current, id, { coins: order.length - i });
  for (const [i, id] of order.entries()) {
    const step = act(current, { type: 'bid', playerId: id, amount: order.length - i });
    current = step.state;
    events.push(...step.events);
  }
  expect(current.round.order).toEqual(order);
  return { state: current, events };
}

/** Soumet les plans dans l'ordre donné ; le dernier déclenche la résolution. */
export function planAll(state: GameState, plans: Record<PlayerId, Plan>): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (const [playerId, plan] of Object.entries(plans)) {
    const step = act(current, { type: 'plan', playerId, plan });
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

/** Joue une manche complète : mises pour obtenir `order`, puis plans. */
export function playRound(
  state: GameState,
  order: PlayerId[],
  plans: Record<PlayerId, Plan>,
): { state: GameState; events: GameEvent[] } {
  const bidding = biddingInOrder(state, order);
  const planning = planAll(bidding.state, plans);
  return { state: planning.state, events: [...bidding.events, ...planning.events] };
}

export const lame = (slot: SlotIndex, boost = 0): Plan => ({ equipment: { card: 'lame-du-chasseur', slot }, boost });

export function damageAt(state: GameState, slot: SlotIndex): number | undefined {
  return state.board[slot]?.damage;
}

export function scoreOf(state: GameState, playerId: PlayerId): number {
  const sideId = getPlayer(state, playerId).sideId;
  return state.sides.find((s) => s.id === sideId)!.score;
}

export function eventsOfType<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}
