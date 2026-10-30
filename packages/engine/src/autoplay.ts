// Joueurs absents ou trop lents : qui doit encore agir, et quel coup jouer à leur place.

import { SLOTS } from './cards.ts';
import type { Action, GameState, PlayerId } from './types.ts';

/** Joueurs de la manche qui n'ont pas encore agi dans la phase en cours. */
export function waitingPlayers(state: GameState): PlayerId[] {
  const { round } = state;
  const acted = (id: PlayerId) => {
    switch (state.phase) {
      case 'bidding':
        return round.bids[id] !== undefined;
      case 'planning':
        return round.plans[id] !== undefined;
      case 'recap':
        return round.ready.includes(id);
      case 'gameOver':
        return true;
    }
  };
  return round.participants.filter((id) => !acted(id));
}

/**
 * Coup joué à la place d'un joueur qui n'agit pas : mise de 0, Lame du chasseur sur le premier
 * monstre du plateau, ou « prêt » pendant le récapitulatif. null s'il a déjà agi.
 */
export function defaultAction(state: GameState, playerId: PlayerId): Action | null {
  if (!waitingPlayers(state).includes(playerId)) return null;
  switch (state.phase) {
    case 'bidding':
      return { type: 'bid', playerId, amount: 0 };
    case 'planning': {
      const slot = SLOTS.find((s) => state.board[s] !== null) ?? 0;
      return { type: 'plan', playerId, plan: { equipment: { card: 'lame-du-chasseur', slot }, boost: 0 } };
    }
    case 'recap':
      return { type: 'ready', playerId };
    case 'gameOver':
      return null;
  }
}
