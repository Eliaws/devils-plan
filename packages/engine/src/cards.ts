// Données des cartes. Équilibrer le jeu = modifier ce fichier.
// Référence : docs/regles-numeriques.md

export const SLOT_COUNT = 3;
export type SlotIndex = 0 | 1 | 2;
export const SLOTS: readonly SlotIndex[] = [0, 1, 2];

// --- Versions des cartes ---------------------------------------------------

/**
 * `imprimees` : effets écrits sur les illustrations des cartes.
 * `classiques` : première version des règles, validée avant les illustrations.
 */
export const CARD_SETS = ['imprimees', 'classiques'] as const;
export type CardSet = (typeof CARD_SETS)[number];
export const DEFAULT_CARD_SET: CardSet = 'imprimees';

// --- Équipements -----------------------------------------------------------

export const EQUIPMENT_IDS = [
  'lame-du-chasseur',
  'double-griffe',
  'poison',
  'souffle-de-glace',
  'citrouille-explosive',
  'charge-abomination',
  'envoutement',
  'morsure',
] as const;
export type EquipmentId = (typeof EQUIPMENT_IDS)[number];

export const EQUIPMENT_NAMES: Record<EquipmentId, string> = {
  'lame-du-chasseur': 'Lame du chasseur',
  'double-griffe': 'Double griffe',
  poison: 'Poison',
  'souffle-de-glace': 'Souffle de glace',
  'citrouille-explosive': 'Citrouille explosive',
  'charge-abomination': "Charge de l'abomination",
  envoutement: 'Envoûtement',
  morsure: 'Morsure',
};

/** Effets de la version « cartes imprimées ». */
export const PRINTED_EQUIPMENT = {
  'lame-du-chasseur': { damage: 3 },
  /** 4 dégâts sur une seule cible, ou 2 dégâts sur deux cibles différentes. */
  'double-griffe': { singleTarget: 4, perTarget: 2 },
  /** 1 dégât immédiat, puis 1 au début de chaque manche jusqu'à la mort du monstre. */
  poison: { immediate: 1, perRound: 1 },
  /** Le monstre est protégé des autres joueurs jusqu'à la prochaine action du lanceur. */
  'souffle-de-glace': { damage: 3 },
  'citrouille-explosive': { damage: 5 },
  /** Dégâts infligés à la prochaine action du joueur (manche suivante). */
  'charge-abomination': { damage: 8 },
  /** Si le monstre est encore vivant à la prochaine action du joueur, il meurt. */
  envoutement: {},
  /** 2 dégâts ; à la prochaine action du joueur, 2 de plus au monstre et 2 à son voisin de gauche. */
  morsure: { damage: 2, followUp: 2, leftFollowUp: 2 },
} as const satisfies Record<EquipmentId, Record<string, number>>;

/** Effets de la version « classiques ». */
export const CLASSIC_EQUIPMENT = {
  'lame-du-chasseur': { damage: 2 },
  'double-griffe': { hits: 2, damagePerHit: 2 },
  poison: { immediate: 1, perRound: 2, rounds: 2 },
  'souffle-de-glace': { damage: 3, freezeBonus: 2 },
  'citrouille-explosive': { damage: 3, splash: 1 },
  'charge-abomination': { damage: 6 },
  envoutement: {},
  morsure: { damage: 3, coins: 1 },
} as const satisfies Record<EquipmentId, Record<string, number>>;

/** La Lame du chasseur revient toujours en main après usage. */
export const PERMANENT_EQUIPMENT: EquipmentId = 'lame-du-chasseur';

/** Équipements qui attaquent (boost, Marque du chasseur et Poing infernal possibles). */
export function isAttackEquipment(card: EquipmentId): boolean {
  return card !== 'envoutement';
}

// --- Cartes Spéciales ------------------------------------------------------

export const SPECIAL_IDS = [
  'bouclier-du-heros',
  'vague-de-choc',
  'eclaireur',
  'echange-macabre',
  'sceau-annulation',
  'marque-du-chasseur',
  'filet-magique',
  'poing-infernal',
] as const;
export type SpecialId = (typeof SPECIAL_IDS)[number];

export const SPECIALS = {
  'bouclier-du-heros': { name: 'Bouclier du héros' },
  'vague-de-choc': { name: 'Vague de choc', damage: 2 },
  eclaireur: { name: "L'éclaireur" },
  'echange-macabre': { name: "L'échange macabre" },
  'sceau-annulation': { name: "Le sceau d'annulation" },
  'marque-du-chasseur': { name: 'Marque du chasseur', points: 3 },
  'filet-magique': { name: 'Le filet magique' },
  'poing-infernal': { name: 'Le Poing infernal', bonus: 2 },
} as const satisfies Record<SpecialId, { name: string; [stat: string]: string | number }>;

export const SPECIAL_COPIES = 2;

// --- Monstres --------------------------------------------------------------

export const MONSTER_IDS = [
  'loup-garou',
  'momie',
  'sylvestre-furieux',
  'frankenstein',
  'vampire',
  'epouvantail',
  'sorciere',
  'sirene',
  'gargouille',
  'zombie',
  'yeti',
  'golem',
  'la-faucheuse',
] as const;
export type MonsterId = (typeof MONSTER_IDS)[number];

export interface MonsterCard {
  name: string;
  hp: number;
  rewards: readonly EquipmentId[];
}

export const MONSTERS: Record<MonsterId, MonsterCard> = {
  'loup-garou': { name: 'Loup-garou', hp: 5, rewards: ['double-griffe'] },
  momie: { name: 'Momie', hp: 7, rewards: ['poison'] },
  'sylvestre-furieux': { name: 'Sylvestre furieux', hp: 9, rewards: ['citrouille-explosive', 'double-griffe'] },
  frankenstein: { name: 'Frankenstein', hp: 10, rewards: ['charge-abomination'] },
  vampire: { name: 'Vampire', hp: 16, rewards: ['morsure'] },
  epouvantail: { name: 'Épouvantail', hp: 5, rewards: ['citrouille-explosive'] },
  sorciere: { name: 'Sorcière', hp: 15, rewards: ['double-griffe', 'poison'] },
  sirene: { name: 'Sirène', hp: 15, rewards: ['envoutement'] },
  gargouille: { name: 'Gargouille', hp: 9, rewards: ['souffle-de-glace'] },
  zombie: { name: 'Zombie', hp: 11, rewards: ['morsure', 'poison'] },
  yeti: { name: 'Yéti', hp: 10, rewards: ['souffle-de-glace', 'double-griffe'] },
  golem: { name: 'Golem', hp: 18, rewards: ['charge-abomination'] },
  'la-faucheuse': { name: 'La Faucheuse', hp: 20, rewards: [] },
};

/** Toujours placée au fond de la pioche : c'est le dernier monstre. */
export const FINAL_MONSTER: MonsterId = 'la-faucheuse';

/** La réserve d'Équipements contient exactement les récompenses des monstres. */
export function buildEquipmentReserve(): EquipmentId[] {
  return MONSTER_IDS.flatMap((id) => MONSTERS[id].rewards);
}

export function buildSpecialDeck(): SpecialId[] {
  return SPECIAL_IDS.flatMap((id) => Array<SpecialId>(SPECIAL_COPIES).fill(id));
}
