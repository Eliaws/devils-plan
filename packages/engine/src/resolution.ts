import { EQUIPMENT, PERMANENT_EQUIPMENT, SLOTS, SPECIALS, type SlotIndex } from './cards.ts';
import { dealDamage, type HitOutcome } from './combat.ts';
import { allMonstersDefeated, getPlayer, removeOne, sideOfPlayer } from './state.ts';
import type { EquipmentPlay, GameEvent, GameState, Plan, PlayerId } from './types.ts';

/** Effets posés au début de la résolution, valables pour cette manche seulement. */
interface ResolutionContext {
  shielded: Set<PlayerId>;
  cancelled: Set<PlayerId>;
  /** Joueurs envoûtés : leur attaque frappe cet emplacement. */
  redirects: Map<PlayerId, SlotIndex>;
}

/**
 * Résout la manche une fois tous les plans connus. Ordre :
 * 1. cartes jouées retirées des mains, boost payé ;
 * 2. Boucliers levés ;
 * 3. Sceaux d'annulation (ordre de passage) ;
 * 4. Échanges macabres (ordre de passage) ;
 * 5. Envoûtements (nouvel ordre de passage) ;
 * 6. actions, une par une, dans l'ordre de passage final.
 */
export function resolveRound(state: GameState, events: GameEvent[]): void {
  const { plans } = state.round;
  const initialOrder = [...state.round.order];
  const planOf = (id: PlayerId): Plan => plans[id]!;
  events.push({ type: 'resolutionStarted', order: initialOrder });

  for (const id of initialOrder) payForPlan(state, id, planOf(id));

  const ctx: ResolutionContext = { shielded: new Set(), cancelled: new Set(), redirects: new Map() };

  for (const id of initialOrder) {
    if (planOf(id).special?.card === 'bouclier-du-heros') {
      ctx.shielded.add(id);
      events.push({ type: 'shieldRaised', playerId: id });
    }
  }

  for (const id of initialOrder) {
    const special = planOf(id).special;
    if (ctx.cancelled.has(id) || special?.card !== 'sceau-annulation') continue;
    if (reachesTarget(ctx, id, special.targetPlayerId, 'sceau-annulation', events)) {
      ctx.cancelled.add(special.targetPlayerId);
      events.push({ type: 'actionCancelled', playerId: special.targetPlayerId, byPlayerId: id });
    }
  }

  const order = [...initialOrder];
  for (const id of initialOrder) {
    if (ctx.cancelled.has(id) || planOf(id).special?.card !== 'echange-macabre') continue;
    const index = order.indexOf(id);
    if (index <= 0) continue;
    const first = order[0]!;
    order[0] = id;
    order[index] = first;
    events.push({ type: 'orderSwapped', playerId: id, withPlayerId: first, order: [...order] });
  }
  state.round.order = order;

  for (const id of order) {
    const equipment = planOf(id).equipment;
    if (ctx.cancelled.has(id) || equipment?.card !== 'envoutement') continue;
    if (reachesTarget(ctx, id, equipment.targetPlayerId, 'envoutement', events)) {
      ctx.redirects.set(equipment.targetPlayerId, equipment.slot);
      events.push({ type: 'enchanted', playerId: id, targetPlayerId: equipment.targetPlayerId, slot: equipment.slot });
    }
  }

  for (const id of order) {
    if (allMonstersDefeated(state)) return;
    if (ctx.cancelled.has(id)) continue;
    resolveAction(state, id, planOf(id), ctx.redirects.get(id) ?? null, events);
  }
}

/** Les cartes vont à la défausse (sauf la Lame) et le boost est payé, même si l'action est annulée ensuite. */
function payForPlan(state: GameState, playerId: PlayerId, plan: Plan): void {
  const player = getPlayer(state, playerId);
  const equipment = plan.equipment?.card;
  if (equipment && equipment !== PERMANENT_EQUIPMENT) {
    removeOne(player.equipment, equipment);
    state.equipmentDiscard.push(equipment);
  }
  const special = plan.special?.card;
  if (special) {
    removeOne(player.specials, special);
    state.specialDiscard.push(special);
  }
  player.coins -= plan.boost;
}

/** Le premier effet adverse qui vise un joueur protégé par un Bouclier est bloqué. */
function reachesTarget(
  ctx: ResolutionContext,
  sourceId: PlayerId,
  targetId: PlayerId,
  card: 'sceau-annulation' | 'envoutement',
  events: GameEvent[],
): boolean {
  if (!ctx.shielded.has(targetId)) return true;
  ctx.shielded.delete(targetId);
  events.push({ type: 'effectBlocked', playerId: targetId, sourcePlayerId: sourceId, card });
  return false;
}

function resolveAction(
  state: GameState,
  playerId: PlayerId,
  plan: Plan,
  redirect: SlotIndex | null,
  events: GameEvent[],
): void {
  const { equipment, special } = plan;
  events.push({ type: 'actionRevealed', playerId, plan, redirectedTo: redirect });

  if (special?.card === 'filet-magique') {
    const monster = state.board[special.slot];
    if (monster && monster.netOwnerId === null) {
      monster.netOwnerId = playerId;
      events.push({ type: 'monsterNetted', playerId, slot: special.slot, monsterId: monster.id });
    }
  }

  if (equipment) {
    const firstHit = resolveEquipment(state, playerId, equipment, plan.boost, redirect, events);
    if (special?.card === 'marque-du-chasseur' && firstHit?.monsterId) {
      const side = sideOfPlayer(state, playerId);
      const points = SPECIALS['marque-du-chasseur'].points;
      side.score += points;
      events.push({ type: 'hunterMarked', playerId, sideId: side.id, points });
    }
  }

  if (special?.card === 'vague-de-choc') {
    for (const slot of SLOTS) {
      if (allMonstersDefeated(state)) return;
      dealDamage(state, slot, SPECIALS['vague-de-choc'].damage, playerId, 'vague-de-choc', false, events);
    }
  }
}

/** Renvoie le résultat du premier coup (null pour l'Envoûtement, qui n'attaque pas). */
function resolveEquipment(
  state: GameState,
  playerId: PlayerId,
  play: EquipmentPlay,
  boost: number,
  redirect: SlotIndex | null,
  events: GameEvent[],
): HitOutcome | null {
  const strike = (slot: SlotIndex, amount: number) =>
    dealDamage(state, redirect ?? slot, amount, playerId, play.card, true, events);

  switch (play.card) {
    case 'envoutement':
      // Appliqué au début de la résolution.
      return null;

    case 'lame-du-chasseur':
    case 'charge-abomination':
      return strike(play.slot, EQUIPMENT[play.card].damage + boost);

    case 'morsure': {
      const hit = strike(play.slot, EQUIPMENT.morsure.damage + boost);
      const amount = EQUIPMENT.morsure.coins;
      getPlayer(state, playerId).coins += amount;
      events.push({ type: 'coinGained', playerId, amount });
      return hit;
    }

    case 'souffle-de-glace': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, EQUIPMENT['souffle-de-glace'].damage + boost);
      const monster = state.board[slot];
      if (hit.monsterId && !hit.killed && monster) {
        monster.frozen = true;
        events.push({ type: 'monsterFrozen', slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'poison': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, EQUIPMENT.poison.immediate + boost);
      const monster = state.board[slot];
      if (hit.monsterId && !hit.killed && monster) {
        monster.poisons.push({ ownerId: playerId, ticksLeft: EQUIPMENT.poison.rounds });
        events.push({ type: 'monsterPoisoned', playerId, slot, monsterId: monster.id });
      }
      return hit;
    }

    case 'citrouille-explosive': {
      const slot = redirect ?? play.slot;
      const hit = strike(play.slot, EQUIPMENT['citrouille-explosive'].damage + boost);
      for (const neighbor of [slot - 1, slot + 1]) {
        if (!SLOTS.includes(neighbor as SlotIndex) || allMonstersDefeated(state)) continue;
        dealDamage(state, neighbor as SlotIndex, EQUIPMENT['citrouille-explosive'].splash, playerId, 'citrouille-eclats', false, events);
      }
      return hit;
    }

    case 'double-griffe': {
      const [first, second] = play.slots;
      const hit = strike(first, EQUIPMENT['double-griffe'].damagePerHit + boost);
      if (!allMonstersDefeated(state)) strike(second, EQUIPMENT['double-griffe'].damagePerHit);
      return hit;
    }
  }
}
