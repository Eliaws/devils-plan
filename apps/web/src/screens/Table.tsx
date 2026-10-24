import type { RoomSnapshot } from '@chasseurs/protocol';
import { TEAMS } from '@chasseurs/protocol';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { Board } from '../components/Board.tsx';
import { OrderStrip, Scoreboard } from '../components/GameInfo.tsx';
import { CARD_SET_LABELS } from '../game/cards.ts';
import { makeNames } from '../game/describe.ts';
import { usePlayback } from '../game/playback.ts';
import { useStore } from '../net/store.ts';
import { paths } from '../router.ts';
import { Presence } from '../ui/primitives.tsx';
import { GameOver } from './GameOver.tsx';

/** Écran partagé (TV, ordinateur) : plateau en grand, QR code, scores et récit des combats. */
export function Table({ room }: { room: RoomSnapshot }) {
  const game = useStore((s) => s.game);
  const frame = usePlayback(game, null);

  if (room.status === 'lobby' || !frame) return <TableLobby room={room} />;

  const { view, caption, flashes } = frame;
  const names = makeNames(view, null);
  const status =
    view.phase === 'bidding'
      ? 'Les chasseurs misent pour passer en premier…'
      : view.phase === 'planning'
        ? 'Les chasseurs préparent leur attaque…'
        : 'Fin de la chasse';

  return (
    <main className="grid min-h-dvh grid-cols-[1fr_22rem] gap-8 p-8">
      <section className="flex min-w-0 flex-col">
        <header className="mb-6 flex items-baseline gap-4">
          <h1 className="text-4xl font-bold">Manche {view.round}</h1>
          <p className="text-xl text-muted">{caption ? 'Résolution' : status}</p>
        </header>

        {view.phase === 'gameOver' && !caption ? (
          <GameOver view={view} room={room} playerId={null} />
        ) : (
          <>
            <div className="mx-auto w-full" style={{ maxWidth: '120dvh' }}>
              <Board view={view} size="lg" flashes={flashes} nameOf={names.player} />
            </div>
            <div className="mt-8 flex min-h-20 items-center justify-center">
              <AnimatePresence mode="wait">
                {caption && (
                  <motion.p
                    key={caption.text + Object.values(flashes)[0]?.key}
                    className="rounded-2xl bg-surface px-8 py-4 text-center text-3xl font-semibold"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    {caption.text}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </section>

      <aside className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
          <div className="rounded-xl bg-white p-2">
            <QRCodeSVG value={paths.invite(room.code)} size={88} />
          </div>
          <div>
            <p className="text-sm text-muted">Code</p>
            <p className="text-3xl font-bold tracking-[0.2em] text-gold">{room.code}</p>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm text-muted">Ordre de passage</h2>
          <OrderStrip view={view} me={null} large />
        </div>

        <div className="min-h-0 flex-1">
          <h2 className="mb-2 text-sm text-muted">Scores</h2>
          <Scoreboard view={view} me={null} large />
        </div>

        <p className="text-sm text-faint">
          {CARD_SET_LABELS[view.cardSet].name} · {view.monsterDeckCount} monstre(s) en réserve
        </p>
      </aside>
    </main>
  );
}

function TableLobby({ room }: { room: RoomSnapshot }) {
  const invite = paths.invite(room.code);
  return (
    <main className="grid min-h-dvh grid-cols-2 items-center gap-16 p-16">
      <section>
        <p className="text-lg tracking-[0.3em] text-gold uppercase">Chasseurs de l'Ombre</p>
        <h1 className="mt-4 text-6xl leading-tight font-bold">Rejoignez la chasse</h1>
        <div className="mt-10 flex items-center gap-8">
          <div className="rounded-3xl bg-white p-5">
            <QRCodeSVG value={invite} size={240} />
          </div>
          <div>
            <p className="text-xl text-muted">ou entrez le code</p>
            <p className="mt-2 text-8xl font-bold tracking-[0.2em] text-gold">{room.code}</p>
            <p className="mt-4 text-lg text-muted">{window.location.host}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface p-8">
        <h2 className="flex items-baseline justify-between text-2xl font-semibold">
          Chasseurs <span className="text-muted tabular-nums">{room.players.length} / 12</span>
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3">
          <AnimatePresence>
            {room.players.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 rounded-xl bg-raised px-4 py-3 text-xl"
              >
                <Presence online={p.connected} />
                <span className="truncate">{p.name}</span>
                {p.teamId && (
                  <span className="ml-auto text-sm text-muted">{TEAMS.find((t) => t.id === p.teamId)?.name}</span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {room.players.length === 0 && <p className="mt-6 text-xl text-faint">En attente des premiers joueurs…</p>}
        <p className="mt-8 text-muted">
          {CARD_SET_LABELS[room.settings.cardSet].name} · Le premier joueur arrivé lance la partie depuis son téléphone.
        </p>
      </section>
    </main>
  );
}
