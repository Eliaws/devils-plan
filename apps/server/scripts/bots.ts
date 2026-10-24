// Outil de développement : fait rejoindre des joueurs automatiques à une partie,
// pour tester seul. Ils misent 0 et attaquent à la Lame un monstre au hasard.
// Usage : npm run bots -w @chasseurs/server -- CODE [nombre] [url]

import type { GameView } from '@chasseurs/engine';
import type { ClientToServerEvents, ServerToClientEvents } from '@chasseurs/protocol';
import { io, type Socket } from 'socket.io-client';

const [code, count = '2', url = 'http://localhost:3000'] = process.argv.slice(2);
if (!code) {
  console.error('Usage : npm run bots -w @chasseurs/server -- CODE [nombre] [url]');
  process.exit(1);
}

const DELAY_MS = 700;

function play(socket: Socket<ServerToClientEvents, ClientToServerEvents>, view: GameView, playerId: string) {
  const me = view.players.find((p) => p.id === playerId);
  if (!me) return;
  if (view.phase === 'bidding' && !me.hasBid) {
    setTimeout(() => socket.emit('game:action', { type: 'bid', amount: 0 }, () => {}), DELAY_MS);
  }
  if (view.phase === 'planning' && !me.hasPlanned) {
    const slots = ([0, 1, 2] as const).filter((slot) => view.board[slot] !== null);
    const slot = slots[Math.floor(Math.random() * slots.length)] ?? 0;
    const plan = { equipment: { card: 'lame-du-chasseur' as const, slot }, boost: 0 };
    setTimeout(() => socket.emit('game:action', { type: 'plan', plan }, () => {}), DELAY_MS);
  }
}

for (let i = 1; i <= Number(count); i++) {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(url, { transports: ['websocket'] });
  let playerId: string | null = null;
  socket.on('connect', async () => {
    const result = await socket.emitWithAck('room:join', { code: code.toUpperCase(), name: `Bot ${i}` });
    if (!result.ok) {
      console.error(`Bot ${i} : ${result.error.message}`);
      socket.disconnect();
      return;
    }
    playerId = result.data.playerId;
    console.log(`Bot ${i} a rejoint ${code.toUpperCase()}`);
  });
  socket.on('game:update', ({ view }) => playerId && play(socket, view, playerId));
}
