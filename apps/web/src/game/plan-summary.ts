import type { GameView, Plan, PlayerId, SlotIndex } from '@umbra/engine';
import { equipmentName, monsterName, SLOT_LABELS, specialName } from './cards.ts';

/** Résumé d'un plan en une ligne : « Double griffe → Golem + Yéti · Sceau → Bob · +2 🪙 ». */
export function planSummary(plan: Plan, view: GameView, nameOf: (id: PlayerId) => string): string {
  const target = (slot: SlotIndex) => {
    const monster = view.board[slot];
    return monster ? monsterName(monster.id) : SLOT_LABELS[slot];
  };
  const { equipment, special } = plan;

  let equipmentPart: string | null = null;
  if (equipment) {
    const slots = 'slots' in equipment ? equipment.slots.map(target).join(' + ') : target(equipment.slot);
    const victim =
      equipment.card === 'envoutement' && equipment.targetPlayerId ? ` (${nameOf(equipment.targetPlayerId)})` : '';
    equipmentPart = `${equipmentName(equipment.card)} → ${slots}${victim}`;
  }

  let specialPart: string | null = null;
  if (special) {
    if (special.card === 'sceau-annulation')
      specialPart = `${specialName(special.card)} → ${nameOf(special.targetPlayerId)}`;
    else if (special.card === 'filet-magique') specialPart = `${specialName(special.card)} → ${target(special.slot)}`;
    else specialPart = specialName(special.card);
  }

  const parts = [equipmentPart, specialPart, plan.boost > 0 ? `+${plan.boost} 🪙` : null].filter(Boolean);
  return parts.join(' · ') || "L'éclaireur seulement";
}
