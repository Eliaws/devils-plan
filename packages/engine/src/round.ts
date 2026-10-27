import { SLOTS } from './cards.ts';
import { dealDamage } from './combat.ts';
import { allMonstersDefeated, emptyRound, GameRuleError, getPlayer } from './state.ts';
import type { GameEvent, GameState, PlayerId, RankingEntry } from './types.ts';

export const COINS_PER_ROUND = 1;

/** Début de manche : +1 pièce à chacun, dégâts de Poison, puis phase de mise. */
export function startRound(state: GameState, number: number, events: GameEvent[]): void {
  state.round = emptyRound(number);
  for (const player of state.players) player.coins += COINS_PER_ROUND;
  events.push({ type: 'roundStarted', round: number });

  applyPoison(state, events);

  if (allMonstersDefeated(state)) {
    finishGame(state, events);
  } else {
    state.phase = 'bidding';
  }
}

function applyPoison(state: GameState, events: GameEvent[]): void {
  for (const slot of SLOTS) {
    const monster = state.board[slot];
    if (!monster) continue;
    for (const poison of [...monster.poisons]) {
      // Le poison s'arrête à la mort du monstre et ne passe pas à son remplaçant.
      if (state.board[slot] !== monster) break;
      if (poison.ticksLeft !== null) poison.ticksLeft -= 1;
      dealDamage(state, slot, poison.amount, poison.ownerId, 'poison-tick', false, events);
    }
    monster.poisons = monster.poisons.filter((p) => p.ticksLeft === null || p.ticksLeft > 0);
  }
}

/** Fin de manche : carte Spéciale au meilleur attaquant, puis pause « récap » jusqu'à ce que tous soient prêts. */
export function endRound(state: GameState, events: GameEvent[]): void {
  awardSpecialCard(state, events);
  state.phase = 'recap';
}

/** Un joueur a lu le récapitulatif. La manche suivante démarre quand tout le monde est prêt. */
export function markReady(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  if (state.phase !== 'recap') {
    throw new GameRuleError('WRONG_PHASE', `Action impossible pendant la phase « ${state.phase} ».`);
  }
  getPlayer(state, playerId);
  if (state.round.ready.includes(playerId)) return;
  state.round.ready.push(playerId);
  events.push({ type: 'playerReady', playerId });
  if (state.players.every((p) => state.round.ready.includes(p.id))) {
    startRound(state, state.round.number + 1, events);
  }
}

/**
 * Le camp qui a infligé le plus de dégâts gagne 1 carte Spéciale.
 * Égalité : le camp dont un membre passe le plus tôt l'emporte.
 * En équipe : au membre qui a tué un monstre, sinon (ou si plusieurs) au plus gros attaquant.
 */
function awardSpecialCard(state: GameState, events: GameEvent[]): void {
  const { order, damage, killers } = state.round;
  const position = (id: PlayerId) => {
    const index = order.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const damageOf = (id: PlayerId) => damage[id] ?? 0;

  const candidates = state.sides
    .map((side) => ({
      side,
      damage: side.playerIds.reduce((sum, id) => sum + damageOf(id), 0),
      position: Math.min(...side.playerIds.map(position)),
    }))
    .filter((c) => c.damage > 0)
    .sort((a, b) => b.damage - a.damage || a.position - b.position);

  const best = candidates[0];
  if (!best) return;

  const members = best.side.playerIds;
  const memberKillers = members.filter((id) => killers.includes(id));
  const pool = memberKillers.length > 0 ? memberKillers : members;
  const winnerId = [...pool].sort((a, b) => damageOf(b) - damageOf(a) || position(a) - position(b))[0]!;

  const card = state.specialDeck.shift();
  if (!card) {
    events.push({ type: 'specialDeckEmpty' });
    return;
  }
  getPlayer(state, winnerId).specials.push(card);
  events.push({ type: 'specialAwarded', playerId: winnerId, sideId: best.side.id, card });
}

/** Classement : PV, puis nombre de monstres tués. Égalité parfaite = rang partagé. */
export function finishGame(state: GameState, events: GameEvent[]): void {
  const sorted = [...state.sides].sort((a, b) => b.score - a.score || b.kills - a.kills);
  const ranking: RankingEntry[] = sorted.map((side) => ({
    sideId: side.id,
    score: side.score,
    kills: side.kills,
    rank: 1 + sorted.filter((o) => o.score > side.score || (o.score === side.score && o.kills > side.kills)).length,
  }));
  state.phase = 'gameOver';
  state.result = {
    ranking,
    winners: ranking.filter((r) => r.rank === 1).map((r) => r.sideId),
  };
  events.push({ type: 'gameOver', result: state.result });
}
