import { CLASSIC_EQUIPMENT, MONSTERS, type MonsterId, SLOTS, type SlotIndex, SPECIALS } from './cards.ts';
import { freshMonster, getPlayer, removeOne, sideOfPlayer } from './state.ts';
import type { DamageCause, GameEvent, GameState, PlayerId } from './types.ts';

export interface HitOutcome {
  /** Monstre touché, ou null si l'emplacement était vide (attaque perdue) ou le monstre protégé. */
  monsterId: MonsterId | null;
  killed: boolean;
}

const MISSED: HitOutcome = { monsterId: null, killed: false };

/**
 * Inflige des dégâts au monstre d'un emplacement.
 * `direct` : attaque d'Équipement sur sa cible, qui profite du gel (version classique).
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
    return MISSED;
  }
  if (monster.protectedBy !== null && monster.protectedBy !== sourceId) {
    events.push({
      type: 'damageBlocked',
      playerId: sourceId,
      protectorId: monster.protectedBy,
      slot,
      monsterId: monster.id,
    });
    return MISSED;
  }

  let total = amount;
  if (direct && monster.frozen) {
    total += CLASSIC_EQUIPMENT['souffle-de-glace'].freezeBonus;
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

export function findMonsterSlot(state: GameState, monsterId: MonsterId): SlotIndex | null {
  return SLOTS.find((slot) => state.board[slot]?.id === monsterId) ?? null;
}

/** Coup fatal : PV au camp du tueur, Équipements au tueur (ou au poseur du Filet), remplacement immédiat. */
export function killMonster(state: GameState, slot: SlotIndex, killerId: PlayerId, events: GameEvent[]): void {
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
  // Les effets différés liés à ce monstre disparaissent avec lui (la Charge vise un emplacement, elle reste).
  state.pending = state.pending.filter((effect) => effect.kind === 'charge' || effect.monsterId !== monster.id);
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

/** Marque du chasseur : +3 PV au camp du joueur quand son attaque touche un monstre. */
export function awardHunterMark(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  const side = sideOfPlayer(state, playerId);
  const points = SPECIALS['marque-du-chasseur'].points;
  side.score += points;
  events.push({ type: 'hunterMarked', playerId, sideId: side.id, points });
}
