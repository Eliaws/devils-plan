import type { PlayerId } from '@umbra/engine';
import { useStore } from '../../net/store.ts';
import { Avatar } from './Avatar.tsx';

/** Portrait d'un joueur de la partie en cours (choisi dans le lobby), cerclé de sa couleur. */
export function PlayerAvatar({
  playerId,
  color,
  className,
}: {
  playerId: PlayerId;
  color?: string | undefined;
  className?: string;
}) {
  const player = useStore((s) => s.room?.players.find((p) => p.id === playerId));
  if (!player) return null;
  return <Avatar id={player.avatar} color={color} className={className} title={player.name} />;
}
