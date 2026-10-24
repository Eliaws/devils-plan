import type { MonsterId } from './cards.ts';
import type { MonsterInPlay, PlayerId, PlayerState, RoundState, SideId, SideState, GameState } from './types.ts';

/** Action refusée par les règles. Interceptée par `apply`, qui la transforme en `{ ok: false }`. */
export class GameRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}

export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new GameRuleError('UNKNOWN_PLAYER', `Joueur inconnu : ${playerId}`);
  return player;
}

export function getSide(state: GameState, sideId: SideId): SideState {
  const side = state.sides.find((s) => s.id === sideId);
  if (!side) throw new Error(`Camp inconnu : ${sideId}`);
  return side;
}

export function sideOfPlayer(state: GameState, playerId: PlayerId): SideState {
  return getSide(state, getPlayer(state, playerId).sideId);
}

/** Vrai pour un joueur et lui-même, ou deux membres d'une même équipe. */
export function sameSide(state: GameState, a: PlayerId, b: PlayerId): boolean {
  return getPlayer(state, a).sideId === getPlayer(state, b).sideId;
}

export function allMonstersDefeated(state: GameState): boolean {
  return state.monsterDeck.length === 0 && state.board.every((m) => m === null);
}

export function freshMonster(id: MonsterId): MonsterInPlay {
  return { id, damage: 0, frozen: false, poisons: [], netOwnerId: null };
}

export function emptyRound(number: number): RoundState {
  return {
    number,
    bids: {},
    revealedBids: null,
    order: [],
    plans: {},
    scouted: {},
    damage: {},
    killers: [],
  };
}

/** Retire un exemplaire d'une carte d'une liste. Renvoie false si absente. */
export function removeOne<T>(list: T[], item: T): boolean {
  const index = list.indexOf(item);
  if (index === -1) return false;
  list.splice(index, 1);
  return true;
}
