import { placeBid, scout, submitPlan } from './planning.ts';
import { resolveRound } from './resolution.ts';
import { endRound, finishGame } from './round.ts';
import { GameRuleError, allMonstersDefeated } from './state.ts';
import type { Action, ApplyResult, GameEvent, GameState } from './types.ts';

/**
 * Point d'entrée unique du moteur : applique une action et renvoie le nouvel état
 * et les événements produits. Fonction pure : l'état reçu n'est jamais modifié.
 */
export function apply(state: GameState, action: Action): ApplyResult {
  const next = structuredClone(state);
  const events: GameEvent[] = [];
  try {
    switch (action.type) {
      case 'bid':
        placeBid(next, action.playerId, action.amount, events);
        break;
      case 'scout':
        scout(next, action.playerId, events);
        break;
      case 'plan':
        if (submitPlan(next, action.playerId, action.plan, events)) {
          resolveRound(next, events);
          if (allMonstersDefeated(next)) finishGame(next, events);
          else endRound(next, events);
        }
        break;
    }
  } catch (error) {
    if (error instanceof GameRuleError) return { ok: false, error: { code: error.code, message: error.message } };
    throw error;
  }
  return { ok: true, state: next, events };
}
