// État client : connexion, salon, dernière vue de la partie.
// Toute la logique réseau passe par ici ; les écrans ne font que lire et appeler des actions.

import type { CardSet, GameEvent, PlayerId } from '@chasseurs/engine';
import type {
  Ack,
  ClientToServerEvents,
  GameActionInput,
  GameUpdate,
  Result,
  RoomSnapshot,
  ServerToClientEvents,
  Session,
  TeamId,
} from '@chasseurs/protocol';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

type Intent = { kind: 'player'; code: string; token: string } | { kind: 'table'; code: string } | null;

interface StoreState {
  connected: boolean;
  intent: Intent;
  /** Identité du joueur sur cet appareil (null pour un écran Table). */
  playerId: PlayerId | null;
  room: RoomSnapshot | null;
  game: GameUpdate | null;
  /** Événements de la dernière résolution, pour le récapitulatif. */
  lastResolution: GameEvent[] | null;
  /** Journal complet de la partie en cours. */
  history: GameEvent[];
  error: string | null;
  /** Salon introuvable ou place perdue : il faut revenir à l'accueil. */
  lost: string | null;
}

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ transports: ['websocket', 'polling'] });

export const useStore = create<StoreState>(() => ({
  connected: false,
  intent: null,
  playerId: null,
  room: null,
  game: null,
  lastResolution: null,
  history: [],
  error: null,
  lost: null,
}));

const set = useStore.setState;

// --- Sessions mémorisées (reconnexion après fermeture de l'onglet) ---------

const SESSIONS_KEY = 'chasseurs:sessions';
const NAME_KEY = 'chasseurs:name';

function readSessions(): Record<string, Session> {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '{}') as Record<string, Session>;
  } catch {
    return {};
  }
}

function saveSession(session: Session) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify({ ...readSessions(), [session.code]: session }));
}

function forgetSession(code: string) {
  const { [code]: _, ...rest } = readSessions();
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(rest));
}

export const hasSession = (code: string) => code in readSessions();
export const lastName = () => localStorage.getItem(NAME_KEY) ?? '';

// --- Appels au serveur ------------------------------------------------------

class ServerError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Events = ClientToServerEvents;
/** Arguments d'un événement, sans l'accusé de réception final. */
type Payload<E extends keyof Events> = Parameters<Events[E]> extends [...infer A, Ack<infer _>] ? A : never;
/** Données renvoyées dans l'accusé de réception. */
type Reply<E extends keyof Events> = Parameters<Events[E]> extends [...infer _, Ack<infer T>] ? T : never;

/** Envoie un message au serveur et attend sa réponse (8 s maximum). */
async function request<E extends keyof Events>(event: E, ...args: Payload<E>): Promise<Reply<E>> {
  const timed = socket.timeout(8000);
  const emit = timed.emitWithAck as unknown as (event: E, ...payload: Payload<E>) => Promise<Result<Reply<E>>>;
  let result: Result<Reply<E>>;
  try {
    result = await emit.call(timed, event, ...args);
  } catch {
    throw new ServerError('TIMEOUT', 'Le serveur ne répond pas. Vérifie ta connexion.');
  }
  if (!result.ok) throw new ServerError(result.error.code, result.error.message);
  return result.data;
}

/** Exécute une action et affiche son éventuelle erreur. Renvoie true en cas de succès. */
async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

function resetGame() {
  set({ game: null, lastResolution: null, history: [] });
}

function joinAsPlayer(session: Session) {
  saveSession(session);
  set({ intent: { kind: 'player', code: session.code, token: session.token }, playerId: session.playerId, lost: null });
}

/** Rattache cet appareil à son salon après une (re)connexion. */
async function restoreIntent() {
  const { intent } = useStore.getState();
  if (!intent) return;
  try {
    if (intent.kind === 'player') {
      await request('room:resume', { code: intent.code, token: intent.token });
    } else {
      await request('room:watch', { code: intent.code });
    }
  } catch (error) {
    if (error instanceof ServerError && ['ROOM_NOT_FOUND', 'UNKNOWN_SESSION'].includes(error.code)) {
      forgetSession(intent.code);
      set({ intent: null, lost: error.message, room: null });
      resetGame();
    }
  }
}

socket.on('connect', () => {
  set({ connected: true });
  void restoreIntent();
});
socket.on('disconnect', () => set({ connected: false }));

socket.on('room:update', (room) => {
  const previous = useStore.getState().room;
  if (room.status === 'lobby' && previous && previous.status !== 'lobby') resetGame();
  set({ room });
});

socket.on('game:update', (update) => {
  const isResolution = update.events.some((e) => e.type === 'resolutionStarted');
  const { history, game } = useStore.getState();
  set({
    game: update,
    history: game ? [...history, ...update.events] : update.events,
    ...(isResolution ? { lastResolution: update.events } : {}),
  });
});

socket.on('room:closed', (reason) => {
  set({ lost: reason, room: null, intent: null });
  resetGame();
});

// --- Actions ----------------------------------------------------------------

export const actions = {
  dismissError: () => set({ error: null }),
  dismissResolution: () => set({ lastResolution: null }),

  /** Crée un salon et y entre comme joueur. Renvoie le code, ou null en cas d'échec. */
  async createAndJoin(name: string): Promise<string | null> {
    let code: string | null = null;
    await attempt(async () => {
      ({ code } = await request('room:create'));
      await actions.joinOrThrow(code, name);
    });
    return code;
  },

  /** Crée un salon affiché sur cet écran (vue Table). */
  async createTable(): Promise<string | null> {
    let code: string | null = null;
    await attempt(async () => {
      ({ code } = await request('room:create'));
    });
    return code;
  },

  async joinOrThrow(code: string, name: string) {
    localStorage.setItem(NAME_KEY, name.trim());
    resetGame();
    const session = await request('room:join', { code, name });
    joinAsPlayer(session);
  },

  join: (code: string, name: string) => attempt(() => actions.joinOrThrow(code, name)),

  /** Reprend sa place dans un salon avec la session mémorisée. */
  async resume(code: string): Promise<boolean> {
    const session = readSessions()[code];
    if (!session) return false;
    set({ intent: { kind: 'player', code, token: session.token }, playerId: session.playerId, lost: null });
    if (socket.connected) await restoreIntent();
    return useStore.getState().intent !== null;
  },

  async watch(code: string) {
    resetGame();
    set({ intent: { kind: 'table', code }, playerId: null, lost: null });
    if (socket.connected) await restoreIntent();
  },

  leave: () =>
    attempt(async () => {
      const { intent } = useStore.getState();
      if (intent?.kind === 'player') {
        await request('room:leave');
        forgetSession(intent.code);
      }
      set({ intent: null, room: null, playerId: null });
      resetGame();
    }),

  setTeam: (teamId: TeamId | null) => attempt(() => request('lobby:team', { teamId })),
  setCardSet: (cardSet: CardSet) => attempt(() => request('lobby:settings', { cardSet })),
  start: () => attempt(() => request('game:start')),
  act: (action: GameActionInput) => attempt(() => request('game:action', action)),
  restart: () => attempt(() => request('game:restart')),
};
