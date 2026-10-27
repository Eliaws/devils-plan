// Contrat entre le serveur et les clients : événements Socket.IO typés
// et schémas Zod pour valider tout ce qui vient d'un client.

import { CARD_SETS, type CardSet, type GameEvent, type GameView, type Plan, type PlayerId } from '@umbra/engine';
import { z } from 'zod';

// --- Salons ----------------------------------------------------------------

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
export const MAX_NAME_LENGTH = 16;

export const TEAMS = [
  { id: 'loups', name: 'Les Loups' },
  { id: 'corbeaux', name: 'Les Corbeaux' },
  { id: 'chouettes', name: 'Les Chouettes' },
  { id: 'serpents', name: 'Les Serpents' },
] as const;
export type TeamId = (typeof TEAMS)[number]['id'];

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .length(ROOM_CODE_LENGTH, 'Le code fait 4 lettres.')
  .regex(/^[A-Z]+$/, 'Le code ne contient que des lettres.');

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Choisis un pseudo.')
  .max(MAX_NAME_LENGTH, `${MAX_NAME_LENGTH} caractères maximum.`);

export const joinInputSchema = z.object({ code: roomCodeSchema, name: playerNameSchema });
export const resumeInputSchema = z.object({ code: roomCodeSchema, token: z.string().min(1).max(100) });
export const watchInputSchema = z.object({ code: roomCodeSchema });
export const settingsInputSchema = z.object({ cardSet: z.enum(CARD_SETS) });
export const teamInputSchema = z.object({
  teamId: z.enum(TEAMS.map((t) => t.id) as [TeamId, ...TeamId[]]).nullable(),
});

// --- Actions de jeu (le serveur ajoute lui-même le playerId) ---------------

const slot = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const playerId = z.string().min(1).max(64);

const equipmentPlaySchema = z.discriminatedUnion('card', [
  z.object({
    card: z.enum([
      'lame-du-chasseur',
      'poison',
      'souffle-de-glace',
      'citrouille-explosive',
      'charge-abomination',
      'morsure',
    ]),
    slot,
  }),
  z.object({ card: z.literal('double-griffe'), slots: z.tuple([slot, slot]) }),
  z.object({ card: z.literal('envoutement'), slot, targetPlayerId: playerId.optional() }),
]);

const specialPlaySchema = z.discriminatedUnion('card', [
  z.object({ card: z.literal('bouclier-du-heros') }),
  z.object({ card: z.literal('vague-de-choc') }),
  z.object({ card: z.literal('echange-macabre') }),
  z.object({ card: z.literal('sceau-annulation'), targetPlayerId: playerId }),
  z.object({ card: z.literal('marque-du-chasseur') }),
  z.object({ card: z.literal('filet-magique'), slot }),
  z.object({ card: z.literal('poing-infernal') }),
]);

export const planSchema = z.object({
  equipment: equipmentPlaySchema.optional(),
  special: specialPlaySchema.optional(),
  boost: z.number().int().min(0).max(999),
}) satisfies z.ZodType<Plan>;

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bid'), amount: z.number().int().min(0).max(999) }),
  z.object({ type: z.literal('scout') }),
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('plan'), plan: planSchema }),
]);
export type GameActionInput = z.infer<typeof gameActionSchema>;

// --- Messages serveur -> client --------------------------------------------

export type RoomStatus = 'lobby' | 'playing' | 'finished';

export interface LobbyPlayer {
  id: PlayerId;
  name: string;
  teamId: TeamId | null;
  connected: boolean;
}

export interface RoomSettings {
  cardSet: CardSet;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  settings: RoomSettings;
  hostId: PlayerId | null;
  players: LobbyPlayer[];
}

export interface GameUpdate {
  view: GameView;
  /** Événements de la dernière action (vide lors d'une (re)connexion). */
  events: GameEvent[];
}

export interface Session {
  code: string;
  playerId: PlayerId;
  /** Secret permettant de reprendre sa place après une déconnexion. */
  token: string;
}

// --- Événements Socket.IO --------------------------------------------------

// --- Réactions (envoyées à l'écran principal) -------------------------------

export const EMOJI_REACTIONS = ['😂', '😱', '🔥', '💀', '👏', '🤡', '😭', '🙏'] as const;
export type EmojiReaction = (typeof EMOJI_REACTIONS)[number];

/** Délai minimal entre deux réactions d'un même joueur. */
export const REACTION_COOLDOWN_MS = 800;

/** Union extensible : on pourra y ajouter { kind: 'gif', ... } plus tard. */
export const reactionInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('emoji'), emoji: z.enum(EMOJI_REACTIONS) }),
]);
export type ReactionPayload = z.infer<typeof reactionInputSchema>;

export interface Reaction {
  id: string;
  playerId: PlayerId;
  name: string;
  payload: ReactionPayload;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type Result<T = null> = { ok: true; data: T } | { ok: false; error: ErrorPayload };
export type Ack<T = null> = (result: Result<T>) => void;

export interface ClientToServerEvents {
  'room:create': (ack: Ack<{ code: string }>) => void;
  'room:join': (input: z.input<typeof joinInputSchema>, ack: Ack<Session>) => void;
  'room:resume': (input: z.input<typeof resumeInputSchema>, ack: Ack<Session>) => void;
  'room:watch': (input: z.input<typeof watchInputSchema>, ack: Ack) => void;
  'room:leave': (ack: Ack) => void;
  'lobby:team': (input: z.input<typeof teamInputSchema>, ack: Ack) => void;
  'lobby:settings': (input: z.input<typeof settingsInputSchema>, ack: Ack) => void;
  'game:start': (ack: Ack) => void;
  'game:action': (input: GameActionInput, ack: Ack) => void;
  'game:restart': (ack: Ack) => void;
  'game:react': (input: ReactionPayload, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:update': (room: RoomSnapshot) => void;
  'game:update': (update: GameUpdate) => void;
  /** Le salon n'existe plus, ou le joueur en a été retiré. */
  'room:closed': (reason: string) => void;
  /** Réaction d'un joueur, diffusée à tout le salon (écran principal compris). */
  'room:reaction': (reaction: Reaction) => void;
}
