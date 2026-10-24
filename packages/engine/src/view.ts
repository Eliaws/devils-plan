import { MONSTERS, type EquipmentId, type MonsterId, type SpecialId } from './cards.ts';
import { sameSide } from './state.ts';
import type {
  GameEvent,
  GameResult,
  GameState,
  Phase,
  Plan,
  PlayerId,
  ScoutEntry,
  SideState,
} from './types.ts';

// Ce qu'un client a le droit de savoir. Le serveur n'envoie jamais l'état brut :
// mains adverses, mises non révélées, plans et PV restants des monstres restent secrets.

export type Viewer = { kind: 'player'; playerId: PlayerId } | { kind: 'table' };

export interface MonsterView {
  id: MonsterId;
  maxHp: number;
  frozen: boolean;
  poisoned: boolean;
  netOwnerId: PlayerId | null;
}

export interface PlayerView {
  id: PlayerId;
  name: string;
  sideId: string;
  coins: number;
  kills: number;
  equipmentCount: number;
  specialCount: number;
  hasBid: boolean;
  hasPlanned: boolean;
  /** Les champs suivants valent null sauf pour soi-même et ses coéquipiers. */
  equipment: EquipmentId[] | null;
  specials: SpecialId[] | null;
  bid: number | null;
  plan: Plan | null;
}

export interface GameView {
  viewer: Viewer;
  phase: Phase;
  round: number;
  board: (MonsterView | null)[];
  monsterDeckCount: number;
  defeatedMonsters: MonsterId[];
  equipmentReserve: EquipmentId[];
  equipmentDiscard: EquipmentId[];
  specialDeckCount: number;
  specialDiscard: SpecialId[];
  players: PlayerView[];
  sides: SideState[];
  order: PlayerId[];
  revealedBids: Record<PlayerId, number> | null;
  /** Rapport de L'éclaireur, pour le joueur qui l'a joué cette manche. */
  scouted: ScoutEntry[] | null;
  result: GameResult | null;
}

function canSeePrivate(state: GameState, viewer: Viewer, playerId: PlayerId): boolean {
  return viewer.kind === 'player' && sameSide(state, viewer.playerId, playerId);
}

export function viewFor(state: GameState, viewer: Viewer): GameView {
  const { round } = state;
  return structuredClone({
    viewer,
    phase: state.phase,
    round: round.number,
    board: state.board.map((m) =>
      m
        ? {
            id: m.id,
            maxHp: MONSTERS[m.id].hp,
            frozen: m.frozen,
            poisoned: m.poisons.length > 0,
            netOwnerId: m.netOwnerId,
          }
        : null,
    ),
    monsterDeckCount: state.monsterDeck.length,
    defeatedMonsters: state.defeatedMonsters,
    equipmentReserve: state.equipmentReserve,
    equipmentDiscard: state.equipmentDiscard,
    specialDeckCount: state.specialDeck.length,
    specialDiscard: state.specialDiscard,
    players: state.players.map((p) => {
      const visible = canSeePrivate(state, viewer, p.id);
      return {
        id: p.id,
        name: p.name,
        sideId: p.sideId,
        coins: p.coins,
        kills: p.kills,
        equipmentCount: p.equipment.length,
        specialCount: p.specials.length,
        hasBid: round.bids[p.id] !== undefined,
        hasPlanned: round.plans[p.id] !== undefined,
        equipment: visible ? p.equipment : null,
        specials: visible ? p.specials : null,
        bid: visible || round.revealedBids ? (round.bids[p.id] ?? null) : null,
        plan: visible ? (round.plans[p.id] ?? null) : null,
      };
    }),
    sides: state.sides,
    order: round.order,
    revealedBids: round.revealedBids,
    scouted: viewer.kind === 'player' ? (round.scouted[viewer.playerId] ?? null) : null,
    result: state.result,
  });
}

/** Filtre les événements d'une action pour un client donné. */
export function eventsFor(state: GameState, events: GameEvent[], viewer: Viewer): GameEvent[] {
  const result: GameEvent[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'scouted':
        if (viewer.kind === 'player' && viewer.playerId === event.playerId) result.push(event);
        break;
      case 'monsterHit':
        result.push({ ...event, amount: null });
        break;
      case 'specialAwarded':
        result.push(canSeePrivate(state, viewer, event.playerId) ? event : { ...event, card: null });
        break;
      default:
        result.push(event);
    }
  }
  return structuredClone(result);
}
