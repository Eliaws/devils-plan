// Brouillon du plan d'une manche : cartes choisies, cibles, boost.
// Gère aussi le ciblage sur le plateau (quel emplacement remplit quoi).

import {
  type CardSet,
  type EquipmentId,
  type EquipmentPlay,
  isAttackEquipment,
  type Plan,
  type PlayerId,
  type SlotIndex,
  type SpecialId,
  type SpecialPlay,
} from '@chasseurs/engine';
import { useState } from 'react';
import { equipmentTarget, specialName, specialTarget } from './cards.ts';

export interface Draft {
  equipment: EquipmentId | null;
  slots: SlotIndex[];
  targetPlayer: PlayerId | null;
  special: SpecialId | null;
  specialSlot: SlotIndex | null;
  specialPlayer: PlayerId | null;
  boost: number;
}

const EMPTY: Draft = {
  equipment: null,
  slots: [],
  targetPlayer: null,
  special: null,
  specialSlot: null,
  specialPlayer: null,
  boost: 0,
};

function fromPlan(plan: Plan | null): Draft {
  if (!plan) return EMPTY;
  const { equipment, special } = plan;
  return {
    equipment: equipment?.card ?? null,
    slots: equipment ? ('slots' in equipment ? [...equipment.slots] : [equipment.slot]) : [],
    targetPlayer: equipment?.card === 'envoutement' ? (equipment.targetPlayerId ?? null) : null,
    special: special?.card ?? null,
    specialSlot: special?.card === 'filet-magique' ? special.slot : null,
    specialPlayer: special?.card === 'sceau-annulation' ? special.targetPlayerId : null,
    boost: plan.boost,
  };
}

export function usePlanDraft(initial: Plan | null, cardSet: CardSet, scouted: boolean) {
  const [draft, setDraft] = useState(() => fromPlan(initial));
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const isAttack = draft.equipment !== null && isAttackEquipment(draft.equipment);
  const neededSlots = draft.equipment ? (equipmentTarget(draft.equipment, cardSet) === 'two-slots' ? 2 : 1) : 0;
  const specialKind = draft.special ? specialTarget(draft.special) : null;

  const selectEquipment = (card: EquipmentId) =>
    setDraft((d) => {
      if (d.equipment === card) return { ...d, equipment: null, slots: [], targetPlayer: null, boost: 0 };
      const attack = isAttackEquipment(card);
      const keepSpecial = attack || (d.special && specialTarget(d.special) !== 'with-attack');
      return {
        ...d,
        equipment: card,
        slots: [],
        targetPlayer: null,
        boost: attack ? d.boost : 0,
        ...(keepSpecial ? {} : { special: null }),
      };
    });

  const selectSpecial = (card: SpecialId) =>
    setDraft((d) =>
      d.special === card
        ? { ...d, special: null, specialSlot: null, specialPlayer: null }
        : { ...d, special: card, specialSlot: null, specialPlayer: null },
    );

  /** Touche un monstre du plateau : complète la cible en attente. */
  const tapSlot = (slot: SlotIndex) =>
    setDraft((d) => {
      const needed = d.equipment ? (equipmentTarget(d.equipment, cardSet) === 'two-slots' ? 2 : 1) : 0;
      const wantsSpecialSlot = d.special !== null && specialTarget(d.special) === 'slot';
      if (needed > 0 && d.slots.length < needed) return { ...d, slots: [...d.slots, slot] };
      if (wantsSpecialSlot && d.specialSlot === null) return { ...d, specialSlot: slot };
      if (needed > 0) return { ...d, slots: [slot] };
      if (wantsSpecialSlot) return { ...d, specialSlot: slot };
      return d;
    });

  const targeting =
    (neededSlots > 0 && draft.slots.length < neededSlots) || (specialKind === 'slot' && draft.specialSlot === null);

  const marks: Partial<Record<number, string>> = {};
  const addMark = (slot: number, mark: string) => {
    marks[slot] = marks[slot] ? `${marks[slot]}${mark}` : mark;
  };
  if (neededSlots === 2) {
    const [a, b] = draft.slots;
    if (a !== undefined && a === b) addMark(a, '×2');
    else {
      if (a !== undefined) addMark(a, '1');
      if (b !== undefined) addMark(b, '2');
    }
  } else if (draft.slots[0] !== undefined) {
    addMark(draft.slots[0], '✓');
  }
  if (draft.specialSlot !== null) addMark(draft.specialSlot, '◎');

  const missing = ((): string | null => {
    if (!draft.equipment && !draft.special && !scouted) return 'Choisis au moins une carte.';
    if (draft.equipment && draft.slots.length < neededSlots) {
      if (neededSlots === 2)
        return draft.slots.length === 0 ? 'Touche la 1re cible.' : 'Touche la 2e cible (ou la même).';
      return draft.equipment === 'envoutement' ? 'Touche le monstre à envoûter.' : 'Touche le monstre à attaquer.';
    }
    if (draft.equipment && equipmentTarget(draft.equipment, cardSet) === 'slot-and-player' && !draft.targetPlayer) {
      return 'Choisis le joueur à envoûter.';
    }
    if (specialKind === 'player' && !draft.specialPlayer) return 'Choisis le joueur visé.';
    if (specialKind === 'slot' && draft.specialSlot === null) return 'Touche le monstre à capturer.';
    if (specialKind === 'with-attack' && !isAttack && draft.special)
      return `${specialName(draft.special)} demande une attaque.`;
    return null;
  })();

  const toPlan = (): Plan | null => {
    if (missing) return null;
    let equipment: EquipmentPlay | undefined;
    if (draft.equipment === 'double-griffe') {
      equipment = { card: 'double-griffe', slots: [draft.slots[0]!, draft.slots[1]!] };
    } else if (draft.equipment === 'envoutement') {
      equipment = {
        card: 'envoutement',
        slot: draft.slots[0]!,
        ...(draft.targetPlayer ? { targetPlayerId: draft.targetPlayer } : {}),
      };
    } else if (draft.equipment) {
      equipment = { card: draft.equipment, slot: draft.slots[0]! };
    }

    let special: SpecialPlay | undefined;
    if (draft.special === 'sceau-annulation') special = { card: draft.special, targetPlayerId: draft.specialPlayer! };
    else if (draft.special === 'filet-magique') special = { card: draft.special, slot: draft.specialSlot! };
    else if (draft.special && draft.special !== 'eclaireur') special = { card: draft.special };

    return { ...(equipment ? { equipment } : {}), ...(special ? { special } : {}), boost: isAttack ? draft.boost : 0 };
  };

  return { draft, update, selectEquipment, selectSpecial, tapSlot, targeting, marks, missing, toPlan, isAttack };
}

export type PlanDraft = ReturnType<typeof usePlanDraft>;
