import type { GameView } from '@chasseurs/engine';
import type { RoomSnapshot } from '@chasseurs/protocol';
import { Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { Scoreboard } from '../components/GameInfo.tsx';
import { sideLabel } from '../game/describe.ts';
import { actions } from '../net/store.ts';
import { navigate, paths } from '../router.ts';
import { Button } from '../ui/primitives.tsx';

export function GameOver({ view, room, playerId }: { view: GameView; room: RoomSnapshot; playerId: string | null }) {
  const winners = view.sides.filter((s) => view.result?.winners.includes(s.id));
  const mySide = view.players.find((p) => p.id === playerId)?.sideId;
  const iWon = mySide !== undefined && view.result?.winners.includes(mySide);
  const isHost = playerId !== null && room.hostId === playerId;

  return (
    <section className="pb-safe flex flex-1 flex-col px-5 pt-8">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Crown className="mx-auto size-12 text-gold" />
        <p className="mt-3 text-sm tracking-[0.25em] text-gold uppercase">
          {winners.length > 1 ? 'Grands Chasseurs ex æquo' : "Grand Chasseur de l'Ombre"}
        </p>
        <h2 className="mt-1 text-3xl font-bold">{winners.map(sideLabel).join(' & ')}</h2>
        {playerId && <p className="mt-2 text-muted">{iWon ? 'Bravo, tu as gagné !' : 'La prochaine sera la bonne.'}</p>}
      </motion.div>

      <div className="mt-8">
        <Scoreboard view={view} me={playerId} />
      </div>

      {playerId && (
        <div className="mt-auto flex flex-col gap-2 pt-8">
          {isHost ? (
            <Button onClick={() => actions.restart()}>Nouvelle partie</Button>
          ) : (
            <p className="py-3 text-center text-sm text-muted">L'hôte peut relancer une partie.</p>
          )}
          <Button
            variant="ghost"
            onClick={async () => {
              if (await actions.leave()) navigate(paths.home());
            }}
          >
            Quitter
          </Button>
        </div>
      )}
    </section>
  );
}
