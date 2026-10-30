import { AVATARS, type AvatarId } from '@umbra/protocol';
import { useId } from 'react';
import { cx } from '../../ui/primitives.tsx';
import { PORTRAITS } from './portraits.tsx';

export const avatarName = (id: AvatarId) => AVATARS.find((a) => a.id === id)?.name ?? '';

/** Portrait de chasseur dans un médaillon rond, cerclé de la couleur du joueur. */
export function Avatar({
  id,
  color,
  className,
  title,
}: {
  id: AvatarId;
  /** Couleur de l'anneau (couleur du joueur). */
  color?: string | undefined;
  className?: string;
  title?: string;
}) {
  const uid = useId();
  const portrait = PORTRAITS[id] ?? PORTRAITS.traqueuse;
  const [inner, outer] = portrait.background;
  return (
    <svg viewBox="0 0 120 120" className={cx('block', className)} role="img" aria-label={title ?? avatarName(id)}>
      <defs>
        <radialGradient id={`${uid}-bg`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={inner} />
          <stop offset="100%" stopColor={outer} />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" r="56" fill={`url(#${uid}-bg)`} />
      <g clipPath={`url(#${uid}-clip)`}>{portrait.art}</g>
      <circle cx="60" cy="60" r="57" fill="none" stroke={color ?? '#e3ac52'} strokeWidth="5" />
    </svg>
  );
}
