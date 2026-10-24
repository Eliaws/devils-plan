import type { EquipmentId, MonsterId, SlotIndex, SpecialId } from './cards.ts';

export type PlayerId = string;
/** Camp qui marque les PV : une équipe, ou un joueur solo. */
export type SideId = string;

// --- Configuration ---------------------------------------------------------

export interface PlayerSetup {
  id: PlayerId;
  name: string;
  /** Joueurs ayant le même teamId jouent en équipe (6 joueurs ou plus). */
  teamId?: string;
}

export interface GameConfig {
  players: PlayerSetup[];
  seed: number;
}

// --- Plan d'action d'une manche --------------------------------------------

export type EquipmentPlay =
  | {
      card: 'lame-du-chasseur' | 'poison' | 'souffle-de-glace' | 'citrouille-explosive' | 'charge-abomination' | 'morsure';
      slot: SlotIndex;
    }
  | { card: 'double-griffe'; slots: [SlotIndex, SlotIndex] }
  | { card: 'envoutement'; targetPlayerId: PlayerId; slot: SlotIndex };

/** L'Éclaireur ne figure pas ici : il se joue via l'action `scout`, pendant la planification. */
export type SpecialPlay =
  | { card: 'bouclier-du-heros' }
  | { card: 'vague-de-choc' }
  | { card: 'echange-macabre' }
  | { card: 'sceau-annulation'; targetPlayerId: PlayerId }
  | { card: 'marque-du-chasseur' }
  | { card: 'filet-magique'; slot: SlotIndex };

export interface Plan {
  equipment?: EquipmentPlay;
  special?: SpecialPlay;
  /** Pièces dépensées pour +1 dégât chacune sur le premier coup de l'Équipement. */
  boost: number;
}

// --- État ------------------------------------------------------------------

export type Phase = 'bidding' | 'planning' | 'gameOver';

export interface PlayerState {
  id: PlayerId;
  name: string;
  sideId: SideId;
  coins: number;
  equipment: EquipmentId[];
  specials: SpecialId[];
  kills: number;
}

export interface SideState {
  id: SideId;
  name: string;
  isTeam: boolean;
  playerIds: PlayerId[];
  score: number;
  kills: number;
}

export interface PoisonEffect {
  ownerId: PlayerId;
  ticksLeft: number;
}

export interface MonsterInPlay {
  id: MonsterId;
  damage: number;
  frozen: boolean;
  poisons: PoisonEffect[];
  /** Joueur qui a posé un Filet magique : il récupère les Équipements à la mort du monstre. */
  netOwnerId: PlayerId | null;
}

export interface ScoutEntry {
  slot: SlotIndex;
  monsterId: MonsterId;
  hpRemaining: number;
}

export interface RoundState {
  number: number;
  /** Mises secrètes, jusqu'à la révélation. */
  bids: Record<PlayerId, number>;
  revealedBids: Record<PlayerId, number> | null;
  /** Ordre de passage (vide avant la révélation des mises). */
  order: PlayerId[];
  plans: Record<PlayerId, Plan>;
  scouted: Record<PlayerId, ScoutEntry[]>;
  /** Dégâts réellement infligés pendant la manche (excédent exclu). */
  damage: Record<PlayerId, number>;
  killers: PlayerId[];
}

export interface RankingEntry {
  sideId: SideId;
  score: number;
  kills: number;
  rank: number;
}

export interface GameResult {
  ranking: RankingEntry[];
  winners: SideId[];
}

export interface GameState {
  rng: number;
  phase: Phase;
  players: PlayerState[];
  sides: SideState[];
  /** Emplacements du plateau (gauche, centre, droite). null = vide (pioche épuisée). */
  board: (MonsterInPlay | null)[];
  /** Index 0 = dessus de la pioche. */
  monsterDeck: MonsterId[];
  defeatedMonsters: MonsterId[];
  equipmentReserve: EquipmentId[];
  equipmentDiscard: EquipmentId[];
  specialDeck: SpecialId[];
  specialDiscard: SpecialId[];
  round: RoundState;
  result: GameResult | null;
}

// --- Actions ---------------------------------------------------------------

export type Action =
  | { type: 'bid'; playerId: PlayerId; amount: number }
  | { type: 'scout'; playerId: PlayerId }
  | { type: 'plan'; playerId: PlayerId; plan: Plan };

// --- Événements (pilotent les animations et le journal) --------------------

export type DamageCause = EquipmentId | 'vague-de-choc' | 'citrouille-eclats' | 'poison-tick';

export type GameEvent =
  | { type: 'roundStarted'; round: number }
  | { type: 'bidPlaced'; playerId: PlayerId }
  | { type: 'bidsRevealed'; bids: Record<PlayerId, number>; order: PlayerId[] }
  | { type: 'scouted'; playerId: PlayerId; report: ScoutEntry[] }
  | { type: 'planSubmitted'; playerId: PlayerId }
  | { type: 'resolutionStarted'; order: PlayerId[] }
  | { type: 'shieldRaised'; playerId: PlayerId }
  | { type: 'effectBlocked'; playerId: PlayerId; sourcePlayerId: PlayerId; card: 'sceau-annulation' | 'envoutement' }
  | { type: 'actionCancelled'; playerId: PlayerId; byPlayerId: PlayerId }
  | { type: 'orderSwapped'; playerId: PlayerId; withPlayerId: PlayerId; order: PlayerId[] }
  | { type: 'enchanted'; playerId: PlayerId; targetPlayerId: PlayerId; slot: SlotIndex }
  | { type: 'actionRevealed'; playerId: PlayerId; plan: Plan; redirectedTo: SlotIndex | null }
  | { type: 'monsterNetted'; playerId: PlayerId; slot: SlotIndex; monsterId: MonsterId }
  /** amount vaut null dans les vues : les PV restants sont secrets. */
  | { type: 'monsterHit'; playerId: PlayerId; slot: SlotIndex; monsterId: MonsterId; cause: DamageCause; amount: number | null }
  | { type: 'attackLost'; playerId: PlayerId; slot: SlotIndex; cause: DamageCause }
  | { type: 'monsterFrozen'; slot: SlotIndex; monsterId: MonsterId }
  | { type: 'monsterPoisoned'; playerId: PlayerId; slot: SlotIndex; monsterId: MonsterId }
  | {
      type: 'monsterKilled';
      playerId: PlayerId;
      sideId: SideId;
      slot: SlotIndex;
      monsterId: MonsterId;
      points: number;
      rewardsTo: PlayerId;
      rewards: EquipmentId[];
    }
  | { type: 'monsterRevealed'; slot: SlotIndex; monsterId: MonsterId }
  | { type: 'hunterMarked'; playerId: PlayerId; sideId: SideId; points: number }
  | { type: 'coinGained'; playerId: PlayerId; amount: number }
  /** card vaut null pour les joueurs qui ne doivent pas la connaître. */
  | { type: 'specialAwarded'; playerId: PlayerId; sideId: SideId; card: SpecialId | null }
  | { type: 'specialDeckEmpty' }
  | { type: 'gameOver'; result: GameResult };

export interface EngineError {
  code: string;
  message: string;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };
