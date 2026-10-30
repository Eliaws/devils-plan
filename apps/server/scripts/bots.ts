// Outil de développement : fait rejoindre des joueurs automatiques à une partie,
// pour tester seul. Ils misent 0, attaquent à la Lame un monstre au hasard,
// réagissent parfois pendant le récapitulatif (émoji, ou GIF si le serveur les permet)
// puis se déclarent prêts.
// Usage : npm run bots -w @umbra/server -- CODE [nombre] [url] [--team loups]
// --team : place le premier bot dans cette équipe (pour tester le mode Équipe).
// --start : le bot hôte lance la partie dès que tous les bots sont là (partie 100 % bots).

import type { GameView } from '@umbra/engine';
import { type ClientToServerEvents, EMOJI_REACTIONS, type ServerToClientEvents, type TeamId } from '@umbra/protocol';
import { io, type Socket } from 'socket.io-client';

const args = process.argv.slice(2);
const teamFlag = args.indexOf('--team');
const team = teamFlag >= 0 ? (args.splice(teamFlag, 2)[1] as TeamId | undefined) : undefined;
const startFlag = args.indexOf('--start');
if (startFlag >= 0) args.splice(startFlag, 1);
const [code, count = '2', url = 'http://localhost:3000'] = args;
if (!code) {
  console.error('Usage : npm run bots -w @umbra/server -- CODE [nombre] [url] [--team loups]');
  process.exit(1);
}

const DELAY_MS = 700;
/** Peu de mots différents : les recherches restent dans le cache du serveur (quota GIPHY). */
const GIF_WORDS = ['bravo', 'mdr', 'peur', 'victoire'];
/** Temps laissé aux humains pour lire le récapitulatif. */
const RECAP_DELAY_MS = 4000;

function play(socket: Socket<ServerToClientEvents, ClientToServerEvents>, view: GameView, playerId: string) {
  const me = view.players.find((p) => p.id === playerId);
  if (!me) return;
  if (view.phase === 'bidding' && !me.hasBid) {
    setTimeout(() => socket.emit('game:action', { type: 'bid', amount: 0 }, () => {}), DELAY_MS);
  }
  if (view.phase === 'recap' && !me.isReady) {
    if (Math.random() < 0.25) {
      setTimeout(() => void sendGif(socket), 500 + Math.random() * 2500);
    } else if (Math.random() < 0.6) {
      const emoji = EMOJI_REACTIONS[Math.floor(Math.random() * EMOJI_REACTIONS.length)]!;
      setTimeout(() => socket.emit('game:react', { kind: 'emoji', emoji }, () => {}), 500 + Math.random() * 2500);
    }
    setTimeout(() => socket.emit('game:action', { type: 'ready' }, () => {}), RECAP_DELAY_MS);
  }
  if (view.phase === 'planning' && !me.hasPlanned) {
    const slots = ([0, 1, 2] as const).filter((slot) => view.board[slot] !== null);
    const slot = slots[Math.floor(Math.random() * slots.length)] ?? 0;
    const plan = { equipment: { card: 'lame-du-chasseur' as const, slot }, boost: 0 };
    setTimeout(() => socket.emit('game:action', { type: 'plan', plan }, () => {}), DELAY_MS);
  }
}

async function sendGif(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
  const query = GIF_WORDS[Math.floor(Math.random() * GIF_WORDS.length)]!;
  const result = await socket.emitWithAck('gif:search', { query });
  if (!result.ok) return;
  const gif = result.data.gifs[Math.floor(Math.random() * Math.min(8, result.data.gifs.length))];
  if (gif) socket.emit('game:react', { kind: 'gif', id: gif.id }, () => {});
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
    if (i === 1 && team) {
      const joined = await socket.emitWithAck('lobby:team', { teamId: team });
      console.log(joined.ok ? `Bot 1 rejoint l'équipe ${team}` : `Équipe refusée : ${joined.error.message}`);
    }
  });
  socket.on('game:update', ({ view }) => playerId && play(socket, view, playerId));
  if (startFlag >= 0) {
    let started = false;
    socket.on('room:update', (room) => {
      if (started || room.status !== 'lobby' || room.hostId !== playerId || room.players.length < Number(count)) return;
      started = true;
      socket.emit('game:start', (result) => console.log(result.ok ? 'Partie lancée' : result.error.message));
    });
  }
}
