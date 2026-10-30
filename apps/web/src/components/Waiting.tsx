import type { GameView, PlayerId } from '@umbra/engine';
import { Timer, UserX } from 'lucide-react';
import { useCountdown } from '../game/hooks.ts';
import { playerStatus } from '../game/status.ts';
import { actions, useStore } from '../net/store.ts';
import { cx, Pill, Presence } from '../ui/primitives.tsx';

/** Joueurs qui n'ont pas encore agi dans la phase en cours. */
export function waitingOf(view: GameView) {
  return view.players.filter((p) => playerStatus(view, p) === 'waiting');
}

/**
 * « En attente de… » avec l'état de connexion de chacun. L'hôte peut jouer le coup par défaut
 * à la place d'un joueur qui tarde ou s'est déconnecté.
 */
export function WaitingList({ view, me }: { view: GameView; me: PlayerId }) {
  const room = useStore((s) => s.room);
  const waiting = waitingOf(view).filter((p) => p.id !== me);
  if (waiting.length === 0) return null;
  const isHost = room?.hostId === me;
  const online = (id: PlayerId) => room?.players.find((p) => p.id === id)?.connected ?? true;

  return (
    <div className="mt-3">
      <p className="text-sm text-muted">En attente de :</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {waiting.map((player) => (
          <li key={player.id} className="flex min-h-10 items-center gap-2 rounded-xl bg-raised px-3">
            <Presence online={online(player.id)} />
            <span className={cx('flex-1 truncate text-sm', !online(player.id) && 'text-muted')}>
              {player.name}
              {!online(player.id) && <span className="text-faint"> · déconnecté</span>}
            </span>
            {isHost && (
              <button
                type="button"
                onClick={() => actions.skip(player.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gold hover:bg-gold/10"
              >
                <UserX className="size-3.5" /> Jouer pour lui
              </button>
            )}
          </li>
        ))}
      </ul>
      {isHost && (
        <p className="mt-2 text-xs text-faint">
          « Jouer pour lui » : mise de 0, Lame sur le premier monstre, ou « prêt » au récapitulatif. Un joueur
          déconnecté est en plus mis de côté jusqu'à son retour.
        </p>
      )}
    </div>
  );
}

/** Compte à rebours du minuteur de phase (chrono ou délai d'attente des absents). */
export function TimerPill() {
  const timer = useStore((s) => s.timer);
  const seconds = useCountdown(timer?.endsAt ?? null);
  if (!timer || seconds === null) return null;
  return (
    <Pill
      className={cx(seconds <= 10 && 'bg-blood/20 text-blood')}
      title={timer.reason === 'chrono' ? 'Temps restant pour jouer' : 'Les absents joueront automatiquement'}
    >
      <Timer className="size-4" />
      {seconds}s
    </Pill>
  );
}
