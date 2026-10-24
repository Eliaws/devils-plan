import { PERMANENT_EQUIPMENT, SLOTS, type SlotIndex, SPECIALS } from './cards.ts';
import { awardHunterMark, dealDamage } from './combat.ts';
import { resolveClassicEquipment } from './effects/classic.ts';
import { resolvePrintedEquipment, triggerPendingEffects } from './effects/printed.ts';
import { allMonstersDefeated, getPlayer, removeOne } from './state.ts';
import type { GameEvent, GameState, Plan, PlayerId } from './types.ts';

/** Effets posés au début de la résolution, valables pour cette manche seulement. */
interface ResolutionContext {
  shielded: Set<PlayerId>;
  cancelled: Set<PlayerId>;
  /** Joueurs envoûtés (version classique) : leur attaque frappe cet emplacement. */
  redirects: Map<PlayerId, SlotIndex>;
}

/**
 * Résout la manche une fois tous les plans connus. Ordre :
 * 1. cartes jouées retirées des mains, boost payé ;
 * 2. Boucliers levés ;
 * 3. Sceaux d'annulation (ordre de passage) ;
 * 4. Échanges macabres (ordre de passage) ;
 * 5. Envoûtements, version classique (nouvel ordre de passage) ;
 * 6. pour chaque joueur, dans l'ordre de passage final : ses effets différés, puis son action.
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

  if (state.cardSet === 'classiques') {
    for (const id of order) {
      const equipment = planOf(id).equipment;
      if (ctx.cancelled.has(id) || equipment?.card !== 'envoutement') continue;
      const targetId = equipment.targetPlayerId;
      if (targetId !== undefined && reachesTarget(ctx, id, targetId, 'envoutement', events)) {
        ctx.redirects.set(targetId, equipment.slot);
        events.push({ type: 'enchanted', playerId: id, targetPlayerId: targetId, slot: equipment.slot });
      }
    }
  }

  for (const id of order) {
    if (allMonstersDefeated(state)) return;
    // Les effets différés se déclenchent même si l'action de cette manche est annulée.
    triggerPendingEffects(state, id, events);
    if (allMonstersDefeated(state) || ctx.cancelled.has(id)) continue;
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
    const bonus = plan.boost + (special?.card === 'poing-infernal' ? SPECIALS['poing-infernal'].bonus : 0);
    const marked = special?.card === 'marque-du-chasseur';
    const firstHit =
      state.cardSet === 'imprimees'
        ? resolvePrintedEquipment(state, playerId, equipment, bonus, marked, events)
        : resolveClassicEquipment(state, playerId, equipment, bonus, redirect, events);
    if (marked && firstHit?.monsterId) awardHunterMark(state, playerId, events);
  }

  if (special?.card === 'vague-de-choc') {
    for (const slot of SLOTS) {
      if (allMonstersDefeated(state)) return;
      dealDamage(state, slot, SPECIALS['vague-de-choc'].damage, playerId, 'vague-de-choc', false, events);
    }
  }
}
