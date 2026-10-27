import type { GameEvent, GameView, PlayerId } from '@umbra/engine';
import { Check, Coins, Hourglass, Skull, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { playerColor } from '../game/colors.ts';
import { describe, type Line, makeNames, sideLabel, type Tone } from '../game/describe.ts';
import { cx } from '../ui/primitives.tsx';

/** Ordre de passage (ou liste des joueurs avant la révélation des mises), avec l'avancement de chacun. */
export function OrderStrip({ view, me, large = false }: { view: GameView; me: PlayerId | null; large?: boolean }) {
  const ordered = view.order.length > 0 ? view.order.map((id) => view.players.find((p) => p.id === id)!) : view.players;
  const done = (p: (typeof view.players)[number]) =>
    view.phase === 'bidding' ? p.hasBid : view.phase === 'recap' ? p.isReady : p.hasPlanned;
  return (
    <ol
      className={cx('flex gap-2', large ? 'flex-wrap' : 'scrollbar-none -mx-4 overflow-x-auto px-4')}
      aria-label="Ordre de passage"
    >
      {ordered.map((p, index) => (
        <li
          key={p.id}
          className={cx(
            'flex shrink-0 items-center gap-1.5 rounded-full border',
            large ? 'px-4 py-2 text-lg' : 'px-3 py-1.5 text-sm',
            p.id === me ? 'border-gold/60 bg-gold/10' : 'border-line bg-surface',
          )}
        >
          <span className="size-2 shrink-0 rounded-full" style={{ background: playerColor(view, p.id) }} aria-hidden />
          {view.order.length > 0 && <span className="text-xs text-muted tabular-nums">{index + 1}</span>}
          <span className="max-w-24 truncate">{p.id === me ? 'Toi' : p.name}</span>
          {view.revealedBids && view.phase === 'planning' && (
            <span className="flex items-center gap-0.5 text-xs text-gold tabular-nums">
              <Coins className="size-3" />
              {view.revealedBids[p.id]}
            </span>
          )}
          {view.phase !== 'gameOver' &&
            (done(p) ? (
              <Check className="size-3.5 text-venom" aria-label="Prêt" />
            ) : (
              <Hourglass className="size-3.5 text-faint" aria-label="En attente" />
            ))}
        </li>
      ))}
    </ol>
  );
}

/** Classement des camps (joueurs solo ou équipes). */
export function Scoreboard({ view, me, large = false }: { view: GameView; me: PlayerId | null; large?: boolean }) {
  const mySide = view.players.find((p) => p.id === me)?.sideId;
  const sides = [...view.sides].sort((a, b) => b.score - a.score || b.kills - a.kills);
  return (
    <ol className={cx('flex flex-col', large ? 'gap-2' : 'gap-1')}>
      {sides.map((side, index) => (
        <li
          key={side.id}
          className={cx(
            'flex items-center gap-3 rounded-xl px-3',
            large ? 'py-3 text-xl' : 'py-2',
            side.id === mySide ? 'bg-gold/10 text-ink' : 'bg-surface',
          )}
        >
          <span className="w-5 text-right text-muted tabular-nums">{index + 1}</span>
          <span className="flex-1 truncate">
            {sideLabel(side)}
            {side.isTeam && (
              <span className="block truncate text-xs text-muted">
                {side.playerIds.map((id) => view.players.find((p) => p.id === id)?.name).join(', ')}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-muted tabular-nums" title="Monstres abattus">
            <Skull className="size-3.5" />
            {side.kills}
          </span>
          <span className="flex min-w-14 items-center justify-end gap-1 font-semibold tabular-nums">
            <Trophy className="size-4 text-gold" />
            {side.score}
          </span>
        </li>
      ))}
    </ol>
  );
}

const TONE_STYLE: Record<Tone, string> = {
  info: 'text-muted',
  hit: 'text-ink',
  kill: 'text-blood font-semibold',
  magic: 'text-arcane',
  blocked: 'text-ice',
  reward: 'text-gold',
};

export function toLines(events: GameEvent[], view: GameView, me: PlayerId | null): Line[] {
  const names = makeNames(view, me);
  return events.map((e) => describe(e, names)).filter((line): line is Line => line !== null);
}

/** Liste d'événements lisible, avec apparition progressive optionnelle. */
export function EventList({ lines, animate = false }: { lines: Line[]; animate?: boolean }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {lines.map((line, index) => (
        <motion.li
          key={index}
          className={cx('text-[15px] leading-snug', TONE_STYLE[line.tone])}
          initial={animate ? { opacity: 0, x: -8 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: animate ? Math.min(index * 0.12, 3) : 0 }}
        >
          {line.text}
        </motion.li>
      ))}
    </ul>
  );
}
