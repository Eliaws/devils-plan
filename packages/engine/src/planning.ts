import { MONSTERS, SLOTS, isDamagingEquipment, type SlotIndex } from './cards.ts';
import { shuffle } from './rng.ts';
import { GameRuleError, getPlayer, removeOne } from './state.ts';
import type { GameEvent, GameState, Plan, PlayerId, ScoutEntry } from './types.ts';

function requirePhase(state: GameState, phase: GameState['phase']): void {
  if (state.phase !== phase) {
    throw new GameRuleError('WRONG_PHASE', `Action impossible pendant la phase « ${state.phase} ».`);
  }
}

function requireCount(value: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new GameRuleError('INVALID_AMOUNT', `${what} : nombre entier positif attendu.`);
  }
  if (value > max) {
    throw new GameRuleError('NOT_ENOUGH_COINS', `${what} : seulement ${max} pièce(s) disponible(s).`);
  }
}

function requireSlot(slot: unknown): asserts slot is SlotIndex {
  if (!SLOTS.includes(slot as SlotIndex)) {
    throw new GameRuleError('INVALID_SLOT', `Emplacement invalide : ${String(slot)}.`);
  }
}

function requireOtherPlayer(state: GameState, playerId: PlayerId, targetId: PlayerId): void {
  getPlayer(state, targetId);
  if (targetId === playerId) {
    throw new GameRuleError('INVALID_TARGET', 'Cette carte doit viser un autre joueur.');
  }
}

// --- Mise ------------------------------------------------------------------

/** Mise secrète. Modifiable jusqu'à ce que tout le monde ait misé. */
export function placeBid(state: GameState, playerId: PlayerId, amount: number, events: GameEvent[]): void {
  requirePhase(state, 'bidding');
  const player = getPlayer(state, playerId);
  requireCount(amount, player.coins, 'Mise');

  state.round.bids[playerId] = amount;
  events.push({ type: 'bidPlaced', playerId });

  if (state.players.every((p) => state.round.bids[p.id] !== undefined)) revealBids(state, events);
}

/** Mise la plus haute en premier, égalités tirées au sort. Tous paient leur mise. */
function revealBids(state: GameState, events: GameEvent[]): void {
  const { bids } = state.round;
  const order = shuffle(state, state.players.map((p) => p.id)).sort((a, b) => bids[b]! - bids[a]!);
  for (const player of state.players) player.coins -= bids[player.id]!;

  state.round.revealedBids = { ...bids };
  state.round.order = order;
  state.phase = 'planning';
  events.push({ type: 'bidsRevealed', bids: { ...bids }, order });
}

// --- Planification ---------------------------------------------------------

/** L'Éclaireur se joue pendant la planification, avec un effet immédiat. Il compte comme la Spéciale du tour. */
export function scout(state: GameState, playerId: PlayerId, events: GameEvent[]): void {
  requirePhase(state, 'planning');
  const player = getPlayer(state, playerId);
  if (state.round.scouted[playerId]) {
    throw new GameRuleError('SPECIAL_ALREADY_USED', 'Vous avez déjà joué une carte Spéciale cette manche.');
  }
  if (state.round.plans[playerId]?.special) {
    throw new GameRuleError('SPECIAL_ALREADY_USED', 'Votre plan contient déjà une carte Spéciale.');
  }
  if (!removeOne(player.specials, 'eclaireur')) {
    throw new GameRuleError('CARD_NOT_IN_HAND', "Vous n'avez pas L'éclaireur.");
  }
  state.specialDiscard.push('eclaireur');

  const report: ScoutEntry[] = [];
  for (const slot of SLOTS) {
    const monster = state.board[slot];
    if (monster) report.push({ slot, monsterId: monster.id, hpRemaining: MONSTERS[monster.id].hp - monster.damage });
  }
  state.round.scouted[playerId] = report;
  events.push({ type: 'scouted', playerId, report });
}

/**
 * Plan secret de la manche. Modifiable jusqu'à ce que tout le monde ait planifié ;
 * renvoie true quand c'est le cas (la résolution peut commencer).
 */
export function submitPlan(state: GameState, playerId: PlayerId, plan: Plan, events: GameEvent[]): boolean {
  requirePhase(state, 'planning');
  validatePlan(state, playerId, plan);
  state.round.plans[playerId] = structuredClone(plan);
  events.push({ type: 'planSubmitted', playerId });
  return state.players.every((p) => state.round.plans[p.id] !== undefined);
}

export function validatePlan(state: GameState, playerId: PlayerId, plan: Plan): void {
  const player = getPlayer(state, playerId);
  const { equipment, special } = plan;
  const scouted = state.round.scouted[playerId] !== undefined;

  if (!equipment && !special && !scouted) {
    throw new GameRuleError('NO_CARD_PLAYED', 'Vous devez jouer au moins une carte.');
  }

  if (equipment) {
    if (!player.equipment.includes(equipment.card)) {
      throw new GameRuleError('CARD_NOT_IN_HAND', `Vous n'avez pas la carte ${equipment.card}.`);
    }
    if (equipment.card === 'double-griffe') {
      equipment.slots.forEach(requireSlot);
    } else {
      requireSlot(equipment.slot);
    }
    if (equipment.card === 'envoutement') requireOtherPlayer(state, playerId, equipment.targetPlayerId);
  }

  if (special) {
    if ((special.card as string) === 'eclaireur') {
      throw new GameRuleError('INVALID_CARD', "L'éclaireur se joue directement pendant la planification.");
    }
    if (scouted) {
      throw new GameRuleError('SPECIAL_ALREADY_USED', 'Vous avez déjà joué L\'éclaireur cette manche.');
    }
    if (!player.specials.includes(special.card)) {
      throw new GameRuleError('CARD_NOT_IN_HAND', `Vous n'avez pas la carte ${special.card}.`);
    }
    if (special.card === 'sceau-annulation') requireOtherPlayer(state, playerId, special.targetPlayerId);
    if (special.card === 'filet-magique') requireSlot(special.slot);
    if (special.card === 'marque-du-chasseur' && !(equipment && isDamagingEquipment(equipment.card))) {
      throw new GameRuleError('MARK_NEEDS_ATTACK', 'La Marque du chasseur se joue avec une attaque.');
    }
  }

  requireCount(plan.boost, player.coins, 'Boost');
  if (plan.boost > 0 && !(equipment && isDamagingEquipment(equipment.card))) {
    throw new GameRuleError('BOOST_NEEDS_ATTACK', 'Le boost ne s\'applique qu\'à un Équipement qui inflige des dégâts.');
  }
}
