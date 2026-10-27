// Métadonnées d'affichage des cartes : illustration, nom, texte court selon la version des cartes.

import {
  type CardSet,
  EQUIPMENT_NAMES,
  type EquipmentId,
  MONSTERS,
  type MonsterId,
  SPECIALS,
  type SpecialId,
} from '@umbra/engine';

const images = import.meta.glob<string>('../assets/cards/*.webp', { eager: true, import: 'default', query: '?url' });

export function cardImage(id: string): string | undefined {
  return images[`../assets/cards/${id}.webp`];
}

export const SLOT_LABELS = ['Gauche', 'Centre', 'Droite'] as const;

export const monsterName = (id: MonsterId) => MONSTERS[id].name;
export const equipmentName = (id: EquipmentId) => EQUIPMENT_NAMES[id];
export const specialName = (id: SpecialId) => SPECIALS[id].name;

const EQUIPMENT_TEXT: Record<CardSet, Record<EquipmentId, string>> = {
  imprimees: {
    'lame-du-chasseur': '3 dégâts. Revient toujours en main.',
    'double-griffe': '4 dégâts sur une cible, ou 2 sur deux cibles.',
    poison: "1 dégât, puis 1 à chaque manche jusqu'à sa mort.",
    'souffle-de-glace': "3 dégâts. Toi seul peux le blesser jusqu'à ton prochain tour.",
    'citrouille-explosive': '5 dégâts.',
    'charge-abomination': '8 dégâts à ton prochain tour.',
    envoutement: "S'il survit, le monstre meurt à ton prochain tour.",
    morsure: '2 dégâts, puis 2 à lui et à son voisin de gauche au prochain tour.',
  },
  classiques: {
    'lame-du-chasseur': '2 dégâts. Revient toujours en main.',
    'double-griffe': '2 coups de 2 dégâts.',
    poison: '1 dégât, puis 2 aux deux manches suivantes.',
    'souffle-de-glace': '3 dégâts. La prochaine attaque sur lui fait +2.',
    'citrouille-explosive': '3 dégâts, et 1 aux monstres voisins.',
    'charge-abomination': '6 dégâts.',
    envoutement: "Choisis où frappera l'attaque d'un autre joueur.",
    morsure: '3 dégâts, et tu gagnes 1 pièce.',
  },
};

const SPECIAL_TEXT: Record<SpecialId, string> = {
  'bouclier-du-heros': 'Bloque le premier effet qui te vise cette manche.',
  'vague-de-choc': '2 dégâts à tous les monstres.',
  eclaireur: 'Révèle tout de suite les PV restants des monstres.',
  'echange-macabre': 'Prends la place du premier joueur.',
  'sceau-annulation': "Annule l'action d'un joueur.",
  'marque-du-chasseur': '+3 PV si ton attaque touche un monstre.',
  'filet-magique': 'À sa mort, tu récupères ses Équipements.',
  'poing-infernal': '+2 dégâts à ton attaque.',
};

export const equipmentText = (id: EquipmentId, set: CardSet) => EQUIPMENT_TEXT[set][id];
export const specialText = (id: SpecialId) => SPECIAL_TEXT[id];

/** Ce que le joueur doit choisir après avoir sélectionné un Équipement. */
export type EquipmentTarget = 'slot' | 'two-slots' | 'slot-and-player';

export function equipmentTarget(id: EquipmentId, set: CardSet): EquipmentTarget {
  if (id === 'double-griffe') return 'two-slots';
  if (id === 'envoutement' && set === 'classiques') return 'slot-and-player';
  return 'slot';
}

/** Ce que demande une carte Spéciale. */
export type SpecialTarget = 'none' | 'player' | 'slot' | 'with-attack' | 'instant';

export function specialTarget(id: SpecialId): SpecialTarget {
  switch (id) {
    case 'sceau-annulation':
      return 'player';
    case 'filet-magique':
      return 'slot';
    case 'marque-du-chasseur':
    case 'poing-infernal':
      return 'with-attack';
    case 'eclaireur':
      return 'instant';
    default:
      return 'none';
  }
}

export const CARD_SET_LABELS: Record<CardSet, { name: string; description: string }> = {
  imprimees: { name: 'Cartes imprimées', description: 'Les effets écrits sur les cartes.' },
  classiques: { name: "Version d'origine", description: 'Les premières valeurs, plus douces.' },
};
