import { defaultAction, waitingPlayers } from './autoplay.ts';
import { clone } from './clone.ts';
import { placeBid, scout, submitPlan } from './planning.ts';
import { resolveRound } from './resolution.ts';
import { endRound, finishGame, markReady } from './round.ts';
import { allMonstersDefeated, GameRuleError, getPlayer } from './state.ts';
import type { Action, ApplyResult, GameEvent, GameState, PlayerId } from './types.ts';

/**
 * Point d'entrée unique du moteur : applique une action et renvoie le nouvel état
 * et les événements produits. Fonction pure : l'état reçu n'est jamais modifié.
 */
export function apply(state: GameState, action: Action): ApplyResult {
  const next = clone(state);
  const events: GameEvent[] = [];
  try {
    run(next, action, events);
    playForAbsents(next, events);
  } catch (error) {
    if (error instanceof GameRuleError) return { ok: false, error: { code: error.code, message: error.message } };
    throw error;
  }
  return { ok: true, state: next, events };
}

function run(state: GameState, action: Action, events: GameEvent[]): void {
  switch (action.type) {
    case 'bid':
      placeBid(state, action.playerId, action.amount, events);
      return;
    case 'scout':
      scout(state, action.playerId, events);
      return;
    case 'plan':
      if (submitPlan(state, action.playerId, action.plan, events)) {
        resolveRound(state, events);
        if (allMonstersDefeated(state)) finishGame(state, events);
        else endRound(state, events);
      }
      return;
    case 'ready':
      markReady(state, action.playerId, events);
      return;
    case 'leave':
      leave(state, action.playerId, events);
      return;
    case 'rejoin':
      rejoin(state, action.playerId, events);
      return;
  }
}

/** Le joueur est parti : il jouera des coups par défaut jusqu'à la fin de la manche, puis plus rien. */
function leave(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  getPlayer(state, playerId);
  if (state.phase === 'gameOver' || state.absent.includes(playerId)) return;
  state.absent.push(playerId);
  events.push({ type: 'playerLeft', playerId });
}

/**
 * Le joueur est revenu. Il reprend sa place à la manche suivante, ou tout de suite si les mises
 * de la manche en cours ne sont pas encore révélées.
 */
function rejoin(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  getPlayer(state, playerId);
  if (!state.absent.includes(playerId)) return;
  state.absent = state.absent.filter((id) => id !== playerId);
  const { round } = state;
  const joinsNow = state.phase === 'bidding' && !round.participants.includes(playerId);
  if (joinsNow) round.participants.push(playerId);
  events.push({ type: 'playerReturned', playerId, nextRound: !joinsNow && !round.participants.includes(playerId) });
}

/** Les absents encore inscrits à la manche jouent leur coup par défaut, phase après phase. */
function playForAbsents(state: GameState, events: GameEvent[]): void {
  // Chaque coup fait avancer la partie : la boucle s'arrête dès qu'aucun absent n'est attendu.
  for (let guard = 0; guard < 1000; guard++) {
    const absent = waitingPlayers(state).find((id) => state.absent.includes(id));
    if (!absent) return;
    const action = defaultAction(state, absent);
    if (!action) return;
    run(state, action, events);
  }
}
