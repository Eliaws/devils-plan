import type { GameView, PlayerId } from '@umbra/engine';
import { type Reaction, type RoomSnapshot, TEAMS } from '@umbra/protocol';
import { Crown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { DeckPile } from '../components/effects/CardBack.tsx';
import { Leaderboard, sideColor } from '../components/table/Leaderboard.tsx';
import { MonsterStage } from '../components/table/MonsterStage.tsx';
import { PlayerTokens } from '../components/table/PlayerTokens.tsx';
import { CARD_SET_LABELS, cardImage } from '../game/cards.ts';
import { initials, playerColor } from '../game/colors.ts';
import { makeNames, sideLabel } from '../game/describe.ts';
import { type Frame, usePlayback } from '../game/playback.ts';
import { useStore } from '../net/store.ts';
import { paths } from '../router.ts';
import { Eclipse, Logo } from '../ui/brand.tsx';

/** Écran principal (TV, ordinateur) : le spectacle de la partie. */
export function Table({ room }: { room: RoomSnapshot }) {
  const game = useStore((s) => s.game);
  const reactions = useStore((s) => s.reactions);
  const frame = usePlayback(game, null);

  return (
    <main className="relative h-dvh overflow-hidden">
      <Atmosphere />
      {room.status === 'lobby' || !frame ? (
        <TableLobby room={room} />
      ) : frame.view.phase === 'gameOver' && !frame.caption ? (
        <TableGameOver view={frame.view} reactions={reactions} />
      ) : (
        <TableGame room={room} frame={frame} reactions={reactions} />
      )}
    </main>
  );
}

/** Brume qui dérive lentement derrière le plateau. */
function Atmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-1/3 -left-1/4 size-[80vw] animate-drift rounded-full bg-[radial-gradient(circle,rgba(110,70,170,0.22)_0%,transparent_65%)]" />
      <div className="absolute -right-1/4 -bottom-1/2 size-[90vw] animate-drift rounded-full bg-[radial-gradient(circle,rgba(227,172,82,0.10)_0%,transparent_60%)] [animation-delay:-20s]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}

// --- Partie en cours ---------------------------------------------------------

function TableGame({ room, frame, reactions }: { room: RoomSnapshot; frame: Frame; reactions: Reaction[] }) {
  const { view, caption, flashes, actorId, cards } = frame;
  const names = makeNames(view, null);

  return (
    <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] gap-[2.5dvh] px-[3vw] py-[3dvh]">
      <header className="flex items-center gap-6">
        <SmallLogo />
        <span className="rounded-full border border-line bg-surface/70 px-4 py-1.5 font-display text-lg tracking-wide">
          Manche {view.round}
        </span>
        <span className="text-muted">{CARD_SET_LABELS[view.cardSet].name}</span>
        <JoinBadge code={room.code} />
      </header>

      <section className="grid min-h-0 grid-cols-[1fr_22vw] gap-[3vw]">
        <div className="flex min-h-0 flex-col items-center justify-center gap-[3dvh]">
          <MonsterStage view={view} flashes={flashes} nameOf={names.player} />
          <div className="flex min-h-[14dvh] w-full items-center justify-center">
            <AnimatePresence mode="wait">
              {caption ? (
                <Caption
                  key={`${caption.text}-${Object.values(flashes)[0]?.key ?? ''}`}
                  text={caption.text}
                  view={view}
                  actorId={actorId}
                  cards={cards}
                />
              ) : (
                <PhaseBanner key={view.phase} view={view} />
              )}
            </AnimatePresence>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-3">
          <DeckPile
            count={view.monsterDeckCount}
            label={view.monsterDeckCount > 1 ? "monstres tapis dans l'ombre" : "monstre tapi dans l'ombre"}
          />
          <h2 className="mt-4 font-display text-lg tracking-wide text-muted">Classement</h2>
          <Leaderboard view={view} />
        </aside>
      </section>

      <PlayerTokens view={view} actorId={caption ? actorId : null} reactions={reactions} />
    </div>
  );
}

function SmallLogo() {
  return (
    <span className="inline-flex items-center gap-3">
      <Eclipse className="size-10" />
      <span className="font-display text-2xl font-bold tracking-[0.25em] text-gilded">UMBRA</span>
    </span>
  );
}

function Caption({
  text,
  view,
  actorId,
  cards,
}: {
  text: string;
  view: GameView;
  actorId: PlayerId | null;
  cards: string[];
}) {
  const actor = view.players.find((p) => p.id === actorId);
  return (
    <motion.div
      className="flex items-center gap-6 rounded-3xl border border-line bg-surface/85 px-8 py-4 shadow-2xl backdrop-blur"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
    >
      {actor && (
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full font-display text-xl font-bold text-bg"
          style={{ background: playerColor(view, actor.id) }}
        >
          {initials(actor.name)}
        </span>
      )}
      <p className="font-display text-[2.1vw] leading-tight font-semibold">{text}</p>
      {cards.map((card, index) => (
        <motion.img
          key={card}
          src={cardImage(card)}
          alt=""
          className="h-[13dvh] rounded-lg shadow-xl"
          initial={{ rotate: -12, y: 20, opacity: 0 }}
          animate={{ rotate: index % 2 ? 4 : -4, y: 0, opacity: 1 }}
          transition={{ delay: 0.1 + index * 0.1, type: 'spring', damping: 14 }}
        />
      ))}
    </motion.div>
  );
}

function PhaseBanner({ view }: { view: GameView }) {
  const total = view.players.length;
  const content = {
    bidding: {
      title: 'Misez !',
      subtitle: 'La plus grosse mise frappe en premier',
      done: view.players.filter((p) => p.hasBid).length,
      verb: 'ont misé',
    },
    planning: {
      title: 'Préparez vos attaques',
      subtitle: 'Chacun choisit ses cartes en secret',
      done: view.players.filter((p) => p.hasPlanned).length,
      verb: 'sont prêts',
    },
    recap: {
      title: `Manche ${view.round} terminée`,
      subtitle: 'Réagissez depuis vos téléphones !',
      done: view.players.filter((p) => p.isReady).length,
      verb: 'prêts pour la suite',
    },
    gameOver: null,
  }[view.phase];
  if (!content) return null;
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="font-display text-[3vw] font-bold tracking-wide text-gilded">{content.title}</p>
      <p className="mt-1 text-[1.3vw] text-muted">{content.subtitle}</p>
      <div className="mx-auto mt-3 flex w-[26vw] items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
          <motion.div
            className="h-full rounded-full bg-gold"
            animate={{ width: `${(content.done / total) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {content.done}/{total} {content.verb}
        </span>
      </div>
    </motion.div>
  );
}

function JoinBadge({ code }: { code: string }) {
  return (
    <div className="ml-auto flex items-center gap-3 rounded-2xl border border-line bg-surface/70 py-2 pr-4 pl-2">
      <div className="rounded-lg bg-white p-1.5">
        <QRCodeSVG value={paths.invite(code)} size={56} />
      </div>
      <div>
        <p className="text-xs text-muted">Code</p>
        <p className="font-display text-2xl font-bold tracking-[0.2em] text-gilded">{code}</p>
      </div>
    </div>
  );
}

// --- Salle d'attente ---------------------------------------------------------

function TableLobby({ room }: { room: RoomSnapshot }) {
  const invite = paths.invite(room.code);
  return (
    <div className="relative z-10 grid h-full grid-cols-[1.1fr_1fr] items-center gap-[5vw] px-[6vw]">
      <section>
        <Logo size="lg" />
        <p className="mt-6 max-w-xl text-[1.6vw] text-muted">
          Les monstres sortent de l'ombre. Rejoignez la chasse depuis votre téléphone.
        </p>
        <div className="mt-10 flex items-center gap-10">
          <motion.div
            className="rounded-3xl bg-white p-5 shadow-[0_0_80px_rgba(227,172,82,0.25)]"
            initial={{ rotate: -3, scale: 0.9, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
          >
            <QRCodeSVG value={invite} size={220} />
          </motion.div>
          <div>
            <p className="text-xl text-muted">ou entrez le code</p>
            <p className="mt-2 font-display text-[6vw] leading-none font-bold tracking-[0.15em] text-gilded">
              {room.code}
            </p>
            <p className="mt-4 text-lg text-muted">{window.location.host}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur">
        <h2 className="flex items-baseline justify-between font-display text-2xl font-semibold">
          Chasseurs <span className="font-sans text-lg text-muted tabular-nums">{room.players.length} / 12</span>
        </h2>
        <ul className="mt-6 grid grid-cols-3 gap-4">
          <AnimatePresence>
            {room.players.map((p) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: p.connected ? 1 : 0.4, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', damping: 14 }}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className="grid size-16 place-items-center rounded-full font-display text-2xl font-bold text-bg"
                  style={{ background: playerColor(room, p.id) }}
                >
                  {initials(p.name)}
                </span>
                <span className="max-w-full truncate text-lg">{p.name}</span>
                {p.teamId && (
                  <span className="-mt-1 text-sm text-muted">{TEAMS.find((t) => t.id === p.teamId)?.name}</span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {room.players.length === 0 && (
          <p className="mt-6 flex items-center gap-3 text-xl text-faint">
            <Eclipse className="size-8 opacity-50" /> En attente des premiers chasseurs…
          </p>
        )}
        <p className="mt-8 text-muted">
          {CARD_SET_LABELS[room.settings.cardSet].name} · Le premier arrivé lance la partie depuis son téléphone.
        </p>
      </section>
    </div>
  );
}

// --- Fin de partie -----------------------------------------------------------

function TableGameOver({ view, reactions }: { view: GameView; reactions: Reaction[] }) {
  const sides = [...view.sides].sort((a, b) => b.score - a.score || b.kills - a.kills);
  // Podium : 2e à gauche, 1er au centre, 3e à droite.
  const podium = [
    { side: sides[1], place: 2, height: 'h-[22dvh]', delay: 0.6 },
    { side: sides[0], place: 1, height: 'h-[32dvh]', delay: 1.2 },
    { side: sides[2], place: 3, height: 'h-[15dvh]', delay: 0.2 },
  ];
  const winners = new Set(view.result?.winners ?? []);
  const leader = sides[0];

  return (
    <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] px-[4vw] py-[4dvh]">
      <header className="flex flex-col items-center text-center">
        <SmallLogo />
        <p className="mt-6 font-display text-[3.4vw] font-bold text-gilded">
          {winners.size > 1 ? 'Victoire partagée !' : leader ? `${sideLabel(leader)} remporte la chasse` : ''}
        </p>
      </header>

      <div className="flex items-end justify-center gap-[2vw] pb-[4dvh]">
        {podium.map(({ side, place, height, delay }) =>
          side ? (
            <motion.div
              key={side.id}
              className="flex w-[18vw] flex-col items-center"
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay, type: 'spring', damping: 14 }}
            >
              {winners.has(side.id) && <Crown className="mb-2 size-[3vw] text-gold" />}
              <p className="max-w-full truncate text-center text-[1.6vw] font-semibold">{sideLabel(side)}</p>
              <p className="mt-1 font-display text-[2.2vw] font-bold tabular-nums">{side.score} PV</p>
              <div
                className={`mt-4 grid w-full place-items-start justify-center rounded-t-2xl pt-4 font-display text-[3vw] font-bold text-bg/70 ${height}`}
                style={{
                  background: `linear-gradient(180deg, ${sideColor(view, side)}, color-mix(in oklab, ${sideColor(view, side)} 40%, black))`,
                }}
              >
                {place}
              </div>
            </motion.div>
          ) : (
            <div key={`vide-${place}`} className="w-[18vw]" />
          ),
        )}
      </div>

      <PlayerTokens view={view} actorId={null} reactions={reactions} />
    </div>
  );
}
