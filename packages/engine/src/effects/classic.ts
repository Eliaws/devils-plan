// Effets des Équipements, version « classiques ».

import { CLASSIC_EQUIPMENT, SLOTS, type SlotIndex } from '../cards.ts';
import { dealDamage, type HitOutcome } from '../combat.ts';
import { allMonstersDefeated, getPlayer } from '../state.ts';
import type { EquipmentPlay, GameEvent, GameState, PlayerId } from '../types.ts';

/**
 * Renvoie le résultat du premier coup (null pour l'Envoûtement, appliqué au début de la résolution).
 * `bonus` (boost et Poing infernal) s'ajoute au premier coup ; `redirect` vient d'un Envoûtement adverse.
 */
export function resolveClassicEquipment(
  state: GameState,
  playerId: PlayerId,
  play: EquipmentPlay,
  bonus: number,
  redirect: SlotIndex | null,
  events: GameEvent[],
): HitOutcome | null {
  const stats = CLASSIC_EQUIPMENT;
  const strike = (slot: SlotIndex, amount: number) =>
    dealDamage(state, redirect ?? slot, amount, playerId, play.card, true, events);

  switch (play.card) {
    case 'envoutement':
      return null;

    case 'lame-du-chasseur':
    case 'charge-abomination':
      return strike(play.slot, stats[play.card].damage + bonus);

    case 'morsure': {
      const hit = strike(play.slot, stats.morsure.damage + bonus);
      const amount = stats.morsure.coins;
      getPlayer(state, playerId).coins += amount;
      events.push({ type: 'coinGained', playerId, amount });
      return hit;
    }

    case 'souffle-de-glace': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, stats['souffle-de-glace'].damage + bonus);
      const monster = state.board[slot];
      if (hit.monsterId && !hit.killed && monster) {
        monster.frozen = true;
        events.push({ type: 'monsterFrozen', slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'poison': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, stats.poison.immediate + bonus);
      const monster = state.board[slot];
      if (hit.monsterId && !hit.killed && monster) {
        monster.poisons.push({ ownerId: playerId, amount: stats.poison.perRound, ticksLeft: stats.poison.rounds });
        events.push({ type: 'monsterPoisoned', playerId, slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'citrouille-explosive': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, stats['citrouille-explosive'].damage + bonus);
      for (const neighbor of [slot - 1, slot + 1]) {
        if (!SLOTS.includes(neighbor as SlotIndex) || allMonstersDefeated(state)) continue;
        const splash = stats['citrouille-explosive'].splash;
        dealDamage(state, neighbor as SlotIndex, splash, playerId, 'citrouille-eclats', false, events);
      }
      return hit;
    }

    case 'double-griffe': {
      const [first, second] = play.slots;
      const hit = strike(first, stats['double-griffe'].damagePerHit + bonus);
      if (!allMonstersDefeated(state)) strike(second, stats['double-griffe'].damagePerHit);
      return hit;
    }
  }
}
