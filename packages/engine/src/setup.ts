import {
  buildEquipmentReserve,
  buildSpecialDeck,
  CARD_SETS,
  DEFAULT_CARD_SET,
  FINAL_MONSTER,
  MONSTER_IDS,
  PERMANENT_EQUIPMENT,
  SLOT_COUNT,
} from './cards.ts';
import { shuffle } from './rng.ts';
import { startRound } from './round.ts';
import { emptyRound, freshMonster, GameRuleError } from './state.ts';
import type { GameConfig, GameEvent, GameState, PlayerState, SideState } from './types.ts';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
/** Les équipes ne sont autorisées qu'à partir de ce nombre de joueurs. */
export const TEAM_MODE_MIN_PLAYERS = 6;
export const MAX_TEAM_SIZE = 3;

/** Crée une partie et démarre la première manche (phase de mise). */
export function createGame(config: GameConfig): { state: GameState; events: GameEvent[] } {
  validateConfig(config);

  const sides: SideState[] = [];
  const players: PlayerState[] = config.players.map((setup) => {
    const sideId = setup.teamId === undefined ? `solo:${setup.id}` : `team:${setup.teamId}`;
    let side = sides.find((s) => s.id === sideId);
    if (!side) {
      side = {
        id: sideId,
        name: setup.teamId ?? setup.name,
        isTeam: setup.teamId !== undefined,
        playerIds: [],
        score: 0,
        kills: 0,
      };
      sides.push(side);
    }
    side.playerIds.push(setup.id);
    return {
      id: setup.id,
      name: setup.name,
      sideId,
      coins: 0,
      equipment: [PERMANENT_EQUIPMENT],
      specials: [],
      kills: 0,
    };
  });

  const state: GameState = {
    rng: config.seed | 0,
    cardSet: config.cardSet ?? DEFAULT_CARD_SET,
    phase: 'bidding',
    players,
    sides,
    board: [],
    monsterDeck: [],
    defeatedMonsters: [],
    equipmentReserve: buildEquipmentReserve(),
    equipmentDiscard: [],
    specialDeck: [],
    specialDiscard: [],
    pending: [],
    absent: [],
    round: emptyRound(0),
    result: null,
  };

  const deck = [
    ...shuffle(
      state,
      MONSTER_IDS.filter((id) => id !== FINAL_MONSTER),
    ),
    FINAL_MONSTER,
  ];
  state.board = deck.splice(0, SLOT_COUNT).map(freshMonster);
  state.monsterDeck = deck;
  state.specialDeck = shuffle(state, buildSpecialDeck());

  const events: GameEvent[] = [];
  startRound(state, 1, events);
  return { state, events };
}

function validateConfig(config: GameConfig): void {
  const { players } = config;
  if (config.cardSet !== undefined && !CARD_SETS.includes(config.cardSet)) {
    throw new GameRuleError('INVALID_CARD_SET', `Version de cartes inconnue : ${String(config.cardSet)}.`);
  }
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new GameRuleError('PLAYER_COUNT', `Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} joueurs.`);
  }
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) {
    throw new GameRuleError('DUPLICATE_PLAYER', 'Deux joueurs ont le même identifiant.');
  }
  const teamSizes = new Map<string, number>();
  for (const p of players) {
    if (p.teamId !== undefined) teamSizes.set(p.teamId, (teamSizes.get(p.teamId) ?? 0) + 1);
  }
  if (teamSizes.size > 0 && players.length < TEAM_MODE_MIN_PLAYERS) {
    throw new GameRuleError(
      'TEAMS_NOT_ALLOWED',
      `Les équipes sont réservées aux parties de ${TEAM_MODE_MIN_PLAYERS} joueurs ou plus.`,
    );
  }
  for (const [teamId, size] of teamSizes) {
    if (size > MAX_TEAM_SIZE) {
      throw new GameRuleError('TEAM_TOO_LARGE', `L'équipe ${teamId} dépasse ${MAX_TEAM_SIZE} joueurs.`);
    }
  }
}
