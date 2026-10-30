import type { GameView, PlayerView } from '@umbra/engine';

/**
 * Où en est un joueur dans la phase en cours :
 * - `done` / `waiting` : il joue cette manche, et a (ou n'a pas encore) agi ;
 * - `absent` : parti, il ne joue plus jusqu'à son retour ;
 * - `next` : revenu en cours de manche, il reprend à la prochaine.
 */
export type PlayerStatus = 'done' | 'waiting' | 'absent' | 'next';

export function playerStatus(view: GameView, player: PlayerView): PlayerStatus {
  if (player.isAbsent) return 'absent';
  if (!player.isParticipant) return 'next';
  const acted = view.phase === 'bidding' ? player.hasBid : view.phase === 'recap' ? player.isReady : player.hasPlanned;
  return acted ? 'done' : 'waiting';
}

/** Avancement de la phase : joueurs ayant agi / joueurs attendus (absents exclus). */
export function phaseProgress(view: GameView): { done: number; total: number } {
  const statuses = view.players.map((p) => playerStatus(view, p));
  const total = statuses.filter((s) => s === 'done' || s === 'waiting').length;
  return { done: statuses.filter((s) => s === 'done').length, total };
}
