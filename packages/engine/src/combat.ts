import { EQUIPMENT, MONSTERS, type MonsterId, type SlotIndex } from './cards.ts';
import { freshMonster, getPlayer, removeOne, sideOfPlayer } from './state.ts';
import type { DamageCause, GameEvent, GameState, PlayerId } from './types.ts';

export interface HitOutcome {
  /** Monstre touché, ou null si l'emplacement était vide (attaque perdue). */
  monsterId: MonsterId | null;
  killed: boolean;
}

/**
 * Inflige des dégâts au monstre d'un emplacement.
 * `direct` : attaque d'Équipement sur sa cible, qui profite du gel.
 * L'excédent de dégâts est perdu et ne compte pas dans les dégâts de la manche.
 */
export function dealDamage(
  state: GameState,
  slot: SlotIndex,
  amount: number,
  sourceId: PlayerId,
  cause: DamageCause,
  direct: boolean,
  events: GameEvent[],
): HitOutcome {
  const monster = state.board[slot];
  if (!monster) {
    events.push({ type: 'attackLost', playerId: sourceId, slot, cause });
    return { monsterId: null, killed: false };
  }

  let total = amount;
  if (direct && monster.frozen) {
    total += EQUIPMENT['souffle-de-glace'].freezeBonus;
    monster.frozen = false;
  }
  const hp = MONSTERS[monster.id].hp;
  const dealt = Math.min(total, hp - monster.damage);
  monster.damage += dealt;
  state.round.damage[sourceId] = (state.round.damage[sourceId] ?? 0) + dealt;
  events.push({ type: 'monsterHit', playerId: sourceId, slot, monsterId: monster.id, cause, amount: dealt });

  if (monster.damage >= hp) {
    killMonster(state, slot, sourceId, events);
    return { monsterId: monster.id, killed: true };
  }
  return { monsterId: monster.id, killed: false };
}

/** Coup fatal : PV au camp du tueur, Équipements au tueur (ou au poseur du Filet), remplacement immédiat. */
function killMonster(state: GameState, slot: SlotIndex, killerId: PlayerId, events: GameEvent[]): void {
  const monster = state.board[slot]!;
  const card = MONSTERS[monster.id];
  const killer = getPlayer(state, killerId);
  const side = sideOfPlayer(state, killerId);

  side.score += card.hp;
  side.kills += 1;
  killer.kills += 1;
  if (!state.round.killers.includes(killerId)) state.round.killers.push(killerId);

  const rewardsTo = monster.netOwnerId ?? killerId;
  const recipient = getPlayer(state, rewardsTo);
  const rewards = card.rewards.filter((reward) => removeOne(state.equipmentReserve, reward));
  recipient.equipment.push(...rewards);

  state.defeatedMonsters.push(monster.id);
  events.push({
    type: 'monsterKilled',
    playerId: killerId,
    sideId: side.id,
    slot,
    monsterId: monster.id,
    points: card.hp,
    rewardsTo,
    rewards,
  });

  const next = state.monsterDeck.shift();
  state.board[slot] = next ? freshMonster(next) : null;
  if (next) events.push({ type: 'monsterRevealed', slot, monsterId: next });
}
