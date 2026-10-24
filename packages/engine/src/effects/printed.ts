// Effets des Équipements, version « cartes imprimées ».
// Plusieurs cartes agissent « au prochain tour du joueur » : elles laissent un effet
// différé, déclenché juste avant son action à la manche suivante.

import { MONSTERS, PRINTED_EQUIPMENT, type SlotIndex } from '../cards.ts';
import { awardHunterMark, dealDamage, findMonsterSlot, type HitOutcome } from '../combat.ts';
import { allMonstersDefeated } from '../state.ts';
import type { EquipmentPlay, GameEvent, GameState, PendingEffect, PlayerId } from '../types.ts';

/** Renvoie le résultat du premier coup immédiat (null pour les effets entièrement différés). */
export function resolvePrintedEquipment(
  state: GameState,
  playerId: PlayerId,
  play: EquipmentPlay,
  bonus: number,
  marked: boolean,
  events: GameEvent[],
): HitOutcome | null {
  const stats = PRINTED_EQUIPMENT;
  const nextRound = state.round.number + 1;
  const strike = (slot: SlotIndex, amount: number) =>
    dealDamage(state, slot, amount, playerId, play.card, true, events);
  const survivor = (slot: SlotIndex, hit: HitOutcome) =>
    hit.monsterId !== null && !hit.killed ? (state.board[slot] ?? null) : null;

  switch (play.card) {
    case 'lame-du-chasseur':
    case 'citrouille-explosive':
      return strike(play.slot, stats[play.card].damage + bonus);

    case 'double-griffe': {
      const [first, second] = play.slots;
      if (first === second) return strike(first, stats['double-griffe'].singleTarget + bonus);
      const hit = strike(first, stats['double-griffe'].perTarget + bonus);
      if (!allMonstersDefeated(state)) strike(second, stats['double-griffe'].perTarget);
      return hit;
    }

    case 'poison': {
      const hit = strike(play.slot, stats.poison.immediate + bonus);
      const monster = survivor(play.slot, hit);
      if (monster) {
        monster.poisons.push({ ownerId: playerId, amount: stats.poison.perRound, ticksLeft: null });
        events.push({ type: 'monsterPoisoned', playerId, slot: play.slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'souffle-de-glace': {
      const hit = strike(play.slot, stats['souffle-de-glace'].damage + bonus);
      const monster = survivor(play.slot, hit);
      if (monster) {
        monster.protectedBy = playerId;
        state.pending = state.pending.filter((e) => !(e.kind === 'protection' && e.monsterId === monster.id));
        state.pending.push({ kind: 'protection', ownerId: playerId, round: nextRound, monsterId: monster.id });
        events.push({ type: 'monsterProtected', playerId, slot: play.slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'charge-abomination': {
      const amount = stats['charge-abomination'].damage + bonus;
      state.pending.push({ kind: 'charge', ownerId: playerId, round: nextRound, slot: play.slot, amount, marked });
      const monsterId = state.board[play.slot]?.id ?? null;
      events.push({ type: 'effectScheduled', playerId, card: play.card, slot: play.slot, monsterId });
      return null;
    }

    case 'envoutement': {
      const monster = state.board[play.slot];
      if (!monster) {
        events.push({ type: 'attackLost', playerId, slot: play.slot, cause: play.card });
        return null;
      }
      state.pending.push({ kind: 'curse', ownerId: playerId, round: nextRound, monsterId: monster.id });
      events.push({ type: 'effectScheduled', playerId, card: play.card, slot: play.slot, monsterId: monster.id });
      return null;
    }

    case 'morsure': {
      const hit = strike(play.slot, stats.morsure.damage + bonus);
      const monster = survivor(play.slot, hit);
      if (monster) {
        state.pending.push({ kind: 'bite', ownerId: playerId, round: nextRound, monsterId: monster.id });
        events.push({ type: 'effectScheduled', playerId, card: play.card, slot: play.slot, monsterId: monster.id });
      }
      return hit;
    }
  }
}

/** Déclenche les effets différés d'un joueur, juste avant son action. */
export function triggerPendingEffects(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const round = state.round.number;
  const due = state.pending.filter((e) => e.ownerId === playerId && e.round <= round);
  if (due.length === 0) return;
  state.pending = state.pending.filter((e) => !due.includes(e));
  for (const effect of due) {
    if (allMonstersDefeated(state)) return;
    triggerEffect(state, effect, events);
  }
}

function triggerEffect(state: GameState, effect: PendingEffect, events: GameEvent[]): void {
  const { ownerId } = effect;
  const stats = PRINTED_EQUIPMENT;

  switch (effect.kind) {
    case 'protection': {
      const slot = findMonsterSlot(state, effect.monsterId);
      const monster = slot === null ? null : state.board[slot];
      if (monster?.protectedBy === ownerId) {
        monster.protectedBy = null;
        events.push({ type: 'protectionEnded', playerId: ownerId, monsterId: monster.id });
      }
      return;
    }

    case 'charge': {
      const monsterId = state.board[effect.slot]?.id ?? null;
      events.push({ type: 'effectTriggered', playerId: ownerId, card: 'charge-abomination', monsterId });
      const hit = dealDamage(state, effect.slot, effect.amount, ownerId, 'charge-abomination', true, events);
      if (effect.marked && hit.monsterId) awardHunterMark(state, ownerId, events);
      return;
    }

    case 'curse': {
      const slot = findMonsterSlot(state, effect.monsterId);
      if (slot === null) return;
      const monster = state.board[slot]!;
      events.push({ type: 'effectTriggered', playerId: ownerId, card: 'envoutement', monsterId: monster.id });
      const remaining = MONSTERS[monster.id].hp - monster.damage;
      dealDamage(state, slot, remaining, ownerId, 'envoutement', false, events);
      return;
    }

    case 'bite': {
      const slot = findMonsterSlot(state, effect.monsterId);
      if (slot === null) return;
      events.push({ type: 'effectTriggered', playerId: ownerId, card: 'morsure', monsterId: effect.monsterId });
      dealDamage(state, slot, stats.morsure.followUp, ownerId, 'morsure-suite', false, events);
      if (slot > 0 && !allMonstersDefeated(state)) {
        dealDamage(state, (slot - 1) as SlotIndex, stats.morsure.leftFollowUp, ownerId, 'morsure-suite', false, events);
      }
      return;
    }
  }
}
