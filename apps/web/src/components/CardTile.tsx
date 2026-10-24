import { motion } from 'motion/react';
import { cardImage } from '../game/cards.ts';
import { cx } from '../ui/primitives.tsx';

/** Carte de la main : illustration recadrée + nom, sélectionnable. */
export function CardTile({
  id,
  name,
  count = 1,
  selected,
  disabled,
  accent = 'gold',
  onClick,
}: {
  id: string;
  name: string;
  count?: number;
  selected: boolean;
  disabled?: boolean;
  accent?: 'gold' | 'arcane';
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={count > 1 ? `${name} (×${count})` : name}
      whileTap={{ scale: 0.96 }}
      className={cx(
        'relative w-24 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-surface text-left transition disabled:opacity-35',
        selected ? (accent === 'gold' ? 'border-gold' : 'border-arcane') : 'border-line',
      )}
    >
      <img
        src={cardImage(id)}
        alt=""
        className="aspect-square w-full object-cover object-[50%_35%]"
        draggable={false}
      />
      <span className="block min-h-10 px-2 py-1.5 text-xs leading-tight font-medium">{name}</span>
      {count > 1 && (
        <span className="absolute top-1 right-1 rounded-full bg-bg/80 px-1.5 text-xs font-semibold tabular-nums">
          ×{count}
        </span>
      )}
    </motion.button>
  );
}
