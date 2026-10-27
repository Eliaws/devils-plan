import type { GameView, SideState } from '@umbra/engine';
import { TEAMS } from '@umbra/protocol';
import { Crown, Skull } from 'lucide-react';
import { motion } from 'motion/react';
import { playerColor } from '../../game/colors.ts';
import { sideLabel } from '../../game/describe.ts';

const TEAM_COLORS = ['#e3ac52', '#5eb1ef', '#a87ff0', '#4cc38a'];

export function sideColor(view: GameView, side: SideState): string {
  if (!side.isTeam) return playerColor(view, side.playerIds[0] ?? '');
  const index = TEAMS.findIndex((t) => t.id === side.name);
  return TEAM_COLORS[index % TEAM_COLORS.length] ?? TEAM_COLORS[0]!;
}

/** Classement animé : les camps se réordonnent et leurs barres grandissent avec le score. */
export function Leaderboard({ view }: { view: GameView }) {
  const sides = [...view.sides].sort((a, b) => b.score - a.score || b.kills - a.kills);
  const best = Math.max(1, ...sides.map((s) => s.score));

  return (
    <ol className="flex flex-col gap-2">
      {sides.map((side, index) => {
        const color = sideColor(view, side);
        return (
          <motion.li
            key={side.id}
            layout
            transition={{ type: 'spring', damping: 22 }}
            className="relative overflow-hidden rounded-xl bg-surface/80 px-4 py-3"
          >
            <motion.div
              className="absolute inset-y-0 left-0 opacity-25"
              style={{ background: color }}
              initial={false}
              animate={{ width: `${(side.score / best) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
            <div className="relative flex items-center gap-3 text-[1.15vw]">
              <span className="w-5 text-muted tabular-nums">{index + 1}</span>
              {index === 0 && side.score > 0 && <Crown className="size-[1.2vw] text-gold" aria-label="En tête" />}
              <span className="flex-1 truncate font-medium">{sideLabel(side)}</span>
              <span className="flex items-center gap-1 text-muted tabular-nums" title="Monstres abattus">
                <Skull className="size-[1vw]" />
                {side.kills}
              </span>
              <span className="w-[3.5vw] text-right font-display font-bold tabular-nums">{side.score}</span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
