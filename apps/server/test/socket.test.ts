import type { AddressInfo } from 'node:net';
import type { ClientToServerEvents, GameUpdate, Result, RoomSnapshot, ServerToClientEvents } from '@umbra/protocol';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type App, createApp } from '../src/app.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: App;
let url: string;
const clients: Client[] = [];

beforeEach(async () => {
  app = createApp();
  await new Promise<void>((resolve) => app.httpServer.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(app.httpServer.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  await app.io.close();
});

async function client(): Promise<Client> {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  return socket;
}

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
  return result.data;
}

/** Enregistre les derniers messages reçus par un client. */
function record(socket: Client) {
  const log = { room: null as RoomSnapshot | null, game: null as GameUpdate | null };
  socket.on('room:update', (room) => {
    log.room = room;
  });
  socket.on('game:update', (update) => {
    log.game = update;
  });
  return log;
}

async function waitFor(condition: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('Délai dépassé');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('serveur Socket.IO', () => {
  it('fait jouer une manche complète à 3 joueurs, avec une vue filtrée pour chacun et pour la table', async () => {
    const host = await client();
    const { code } = unwrap(await host.emitWithAck('room:create'));
    const table = await client();
    const tableLog = record(table);
    unwrap(await table.emitWithAck('room:watch', { code }));

    const players = [host, await client(), await client()];
    const logs = players.map(record);
    const sessions = [];
    for (const [i, socket] of players.entries()) {
      sessions.push(unwrap(await socket.emitWithAck('room:join', { code, name: `Joueur ${i + 1}` })));
    }
    await waitFor(() => tableLog.room?.players.length === 3);
    expect(tableLog.room!.hostId).toBe(sessions[0]!.playerId);
    expect(tableLog.room!.players.every((p) => p.connected)).toBe(true);

    unwrap(await host.emitWithAck('game:start'));
    await waitFor(() => tableLog.game !== null);
    const startView = tableLog.game!.view;
    expect(startView.viewer).toEqual({ kind: 'table' });
    expect(startView.phase).toBe('bidding');
    expect(startView.players.every((p) => p.equipment === null)).toBe(true);

    for (const socket of players) unwrap(await socket.emitWithAck('game:action', { type: 'bid', amount: 0 }));
    for (const [i, socket] of players.entries()) {
      const slot = (i % 3) as 0 | 1 | 2;
      unwrap(
        await socket.emitWithAck('game:action', {
          type: 'plan',
          plan: { equipment: { card: 'lame-du-chasseur', slot }, boost: 0 },
        }),
      );
    }

    // Le dernier plan déclenche la résolution : chacun reçoit sa vue du récapitulatif.
    await waitFor(() => logs.every((log) => log.game?.view.phase === 'recap'));
    const first = logs[0]!.game!;
    expect(first.view.players[0]!.equipment).toEqual(['lame-du-chasseur']);
    expect(first.view.players[1]!.equipment).toBeNull();
    expect(first.events.some((e) => e.type === 'resolutionStarted')).toBe(true);
    expect(first.events.filter((e) => e.type === 'monsterHit').every((e) => e.amount === null)).toBe(true);

    // La manche suivante ne démarre que quand tout le monde a lu le récapitulatif.
    for (const socket of players.slice(0, 2)) unwrap(await socket.emitWithAck('game:action', { type: 'ready' }));
    expect(logs[0]!.game!.view.phase).toBe('recap');
    unwrap(await players[2]!.emitWithAck('game:action', { type: 'ready' }));
    await waitFor(() => logs.every((log) => log.game?.view.round === 2 && log.game.view.phase === 'bidding'));
  });

  it('diffuse les réactions à tout le salon, avec un délai minimal entre deux réactions', async () => {
    const alice = await client();
    const { code } = unwrap(await alice.emitWithAck('room:create'));
    unwrap(await alice.emitWithAck('room:join', { code, name: 'Alice' }));
    const table = await client();
    unwrap(await table.emitWithAck('room:watch', { code }));
    const received: string[] = [];
    table.on('room:reaction', (reaction) => {
      if (reaction.payload.kind === 'emoji') received.push(`${reaction.name} ${reaction.payload.emoji}`);
    });

    unwrap(await alice.emitWithAck('game:react', { kind: 'emoji', emoji: '🔥' }));
    const tooFast = await alice.emitWithAck('game:react', { kind: 'emoji', emoji: '😂' });
    expect(tooFast).toMatchObject({ ok: false, error: { code: 'TOO_FAST' } });
    const invalid = await alice.emitWithAck('game:react', { kind: 'emoji', emoji: '🍕' } as never);
    expect(invalid).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });

    await waitFor(() => received.length === 1);
    expect(received).toEqual(['Alice 🔥']);
  });

  it('rend sa place à un joueur qui se reconnecte avec son jeton', async () => {
    const alice = await client();
    const { code } = unwrap(await alice.emitWithAck('room:create'));
    const session = unwrap(await alice.emitWithAck('room:join', { code, name: 'Alice' }));
    alice.disconnect();

    const again = await client();
    const resumed = unwrap(await again.emitWithAck('room:resume', { code, token: session.token }));
    expect(resumed.playerId).toBe(session.playerId);
  });

  it('valide les messages et renvoie des erreurs lisibles', async () => {
    const socket = await client();
    const bad = await socket.emitWithAck('room:join', { code: 'ZZ', name: 'Alice' });
    expect(bad).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT', message: 'Le code fait 4 lettres.' } });

    const missing = await socket.emitWithAck('room:join', { code: 'ZZZZ', name: 'Alice' });
    expect(missing).toMatchObject({ ok: false, error: { code: 'ROOM_NOT_FOUND' } });

    const notJoined = await socket.emitWithAck('game:action', { type: 'bid', amount: 0 });
    expect(notJoined).toMatchObject({ ok: false, error: { code: 'NOT_IN_ROOM' } });

    const garbage = await socket.emitWithAck('game:action', { type: 'pirate' } as never);
    expect(garbage).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
  });
});
