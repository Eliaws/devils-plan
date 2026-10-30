import type { GameView, PlayerId } from '@umbra/engine';
import type { Reaction } from '@umbra/protocol';
import { Check, Coins } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { initials, playerColor } from '../../game/colors.ts';
import { playerStatus } from '../../game/status.ts';
import { cx } from '../../ui/primitives.tsx';
import { orderedPlayers, StatusIcon } from '../GameInfo.tsx';

/**
 * Les joueurs en jetons colorés, dans l'ordre de passage. Le joueur qui agit est mis en avant,
 * et les réactions envoyées depuis les téléphones s'envolent au-dessus de leur auteur.
 */
export function PlayerTokens({
  view,
  actorId,
  reactions,
}: {
  view: GameView;
  actorId: PlayerId | null;
  reactions: Reaction[];
}) {
  const ordered = orderedPlayers(view);
  const scoreOf = (sideId: string) => view.sides.find((s) => s.id === sideId)?.score ?? 0;

  return (
    <ol className="flex flex-wrap items-end justify-center gap-x-[2.2vw] gap-y-4" aria-label="Joueurs">
      {ordered.map((player, index) => {
        const color = playerColor(view, player.id);
        const acting = player.id === actorId;
        return (
          <motion.li
            key={player.id}
            layout
            className="relative flex w-[7.5vw] min-w-20 flex-col items-center"
            animate={{
              scale: acting ? 1.18 : 1,
              opacity: player.isAbsent ? 0.35 : actorId && !acting ? 0.55 : 1,
              filter: player.isAbsent ? 'grayscale(1)' : 'grayscale(0)',
            }}
            transition={{ type: 'spring', damping: 18 }}
          >
            <ReactionStream reactions={reactions.filter((r) => r.playerId === player.id)} />
            <div className="relative">
              <div
                className="grid size-[4.2vw] min-h-14 min-w-14 place-items-center rounded-full font-display text-[1.5vw] font-bold text-bg"
                style={{
                  background: `radial-gradient(circle at 35% 30%, ${color}, color-mix(in oklab, ${color} 55%, black))`,
                  boxShadow: acting ? `0 0 0 3px #08080c, 0 0 0 6px ${color}, 0 0 40px ${color}` : 'none',
                }}
              >
                {initials(player.name)}
              </div>
              {view.order.includes(player.id) && (
                <span className="absolute -top-1 -left-1 grid size-6 place-items-center rounded-full border border-line bg-bg text-xs font-semibold tabular-nums">
                  {index + 1}
                </span>
              )}
              {view.phase !== 'gameOver' && (
                <span
                  className={cx(
                    'absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full border border-line',
                    playerStatus(view, player) === 'done' ? 'bg-venom text-bg' : 'bg-raised',
                  )}
                >
                  {playerStatus(view, player) === 'done' ? (
                    <Check className="size-3.5" />
                  ) : (
                    <StatusIcon status={playerStatus(view, player)} />
                  )}
                </span>
              )}
            </div>
            <span className="mt-2 max-w-full truncate text-[1.1vw] font-medium">{player.name}</span>
            {player.isAbsent && <span className="text-[0.9vw] text-blood">absent</span>}
            <span className="flex items-center gap-2 text-[0.95vw] text-muted tabular-nums">
              <span className="text-gold">{scoreOf(player.sideId)} PV</span>
              <span className="flex items-center gap-0.5">
                <Coins className="size-[0.95vw]" />
                {player.coins}
              </span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

function ReactionStream({ reactions }: { reactions: Reaction[] }) {
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 h-0 w-0">
      <AnimatePresence>
        {reactions.map((reaction) => {
          const sway = reaction.id.charCodeAt(0) % 2 ? 28 : -28;
          return (
            <span key={reaction.id} className="absolute bottom-0 left-0 -translate-x-1/2">
              <motion.span
                className="block text-[3.4vw] drop-shadow-[0_6px_16px_rgba(0,0,0,0.8)]"
                initial={{ y: 0, opacity: 0, scale: 0.4 }}
                animate={{ y: -260, x: [0, sway, -sway / 2, 0], opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1, 1] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3.2, ease: 'easeOut' }}
              >
                {reaction.payload.kind === 'emoji' ? reaction.payload.emoji : null}
              </motion.span>
            </span>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
