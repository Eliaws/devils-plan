import type { GameView, PlayerId } from '@umbra/engine';
import type { Reaction } from '@umbra/protocol';
import { Check, Coins } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { playerColor } from '../../game/colors.ts';
import { playerStatus } from '../../game/status.ts';
import { cx } from '../../ui/primitives.tsx';
import { PlayerAvatar } from '../avatars/PlayerAvatar.tsx';
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
    <ol className="relative z-20 flex flex-wrap items-end justify-center gap-x-[2.2vw] gap-y-4" aria-label="Joueurs">
      {ordered.map((player, index) => {
        const color = playerColor(view, player.id);
        const acting = player.id === actorId;
        return (
          <motion.li key={player.id} layout="position" className="relative w-[7.5vw] min-w-20">
            {/* Hors du jeton estompé : une réaction reste toujours bien visible. */}
            <ReactionBubble reactions={reactions.filter((r) => r.playerId === player.id)} color={color} />
            <motion.div
              className="flex flex-col items-center"
              animate={{
                scale: acting ? 1.18 : 1,
                opacity: player.isAbsent ? 0.35 : actorId && !acting ? 0.55 : 1,
                filter: player.isAbsent ? 'grayscale(1)' : 'grayscale(0)',
              }}
              transition={{ type: 'spring', damping: 18 }}
            >
              <div className="relative">
                <div
                  className="size-[4.6vw] min-h-14 min-w-14 rounded-full"
                  style={{ boxShadow: acting ? `0 0 0 3px #08080c, 0 0 0 6px ${color}, 0 0 40px ${color}` : 'none' }}
                >
                  <PlayerAvatar playerId={player.id} color={color} className="size-full" />
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
            </motion.div>
          </motion.li>
        );
      })}
    </ol>
  );
}

/**
 * Dernière réaction d'un joueur, dans une bulle à sa couleur qui pointe vers son jeton :
 * on voit tout de suite qui a réagi. Une nouvelle réaction remplace la précédente.
 */
function ReactionBubble({ reactions, color }: { reactions: Reaction[]; color: string }) {
  const latest = reactions.at(-1);
  return (
    <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 h-0 w-0">
      <AnimatePresence>
        {latest && (
          <motion.div
            key={latest.id}
            className="absolute bottom-0 left-0 flex origin-bottom -translate-x-1/2 flex-col items-center"
            initial={{ y: 12, opacity: 0, scale: 0.4 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', damping: 14, stiffness: 260 }}
          >
            <div
              className="overflow-hidden rounded-2xl border-2 bg-surface shadow-[0_10px_30px_rgba(0,0,0,0.7)]"
              style={{ borderColor: color }}
            >
              {latest.payload.kind === 'gif' ? (
                <>
                  <img
                    src={latest.payload.gif.url}
                    alt={latest.payload.gif.title}
                    className="block max-w-none object-cover"
                    style={{
                      height: 'clamp(96px, 11vw, 220px)',
                      aspectRatio: `${latest.payload.gif.width} / ${latest.payload.gif.height}`,
                    }}
                  />
                  <p className="truncate px-2 py-0.5 text-center text-[clamp(11px,0.85vw,16px)] font-semibold">
                    {latest.name}
                  </p>
                </>
              ) : (
                <p className="flex items-center gap-1.5 py-1 pr-3 pl-2 whitespace-nowrap">
                  <span className="text-[clamp(20px,1.7vw,34px)] leading-none">{latest.payload.emoji}</span>
                  <span className="max-w-[8vw] truncate text-[clamp(11px,0.85vw,16px)] font-semibold">
                    {latest.name}
                  </span>
                </p>
              )}
            </div>
            {/* Pointe de la bulle, vers le jeton de l'auteur. */}
            <span
              className="-mt-px size-0 border-x-[7px] border-t-[8px] border-x-transparent"
              style={{ borderTopColor: color }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
