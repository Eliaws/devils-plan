import { type CSSProperties, useId } from 'react';
import { cx } from '../../ui/primitives.tsx';

/** Dos des cartes Umbra : cadre doré, treillis d'ombre et éclipse au centre. */
export function CardBack({ className, style }: { className?: string; style?: CSSProperties }) {
  const id = useId();
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 200 300" className={cx('block', className)} style={style} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d1530" />
          <stop offset="100%" stopColor="#09080d" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6dca3" />
          <stop offset="50%" stopColor="#e3ac52" />
          <stop offset="100%" stopColor="#8a5c1f" />
        </linearGradient>
        <radialGradient id={`${id}-corona`} cx="50%" cy="50%" r="50%">
          <stop offset="40%" stopColor="#e3ac52" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#e3ac52" stopOpacity="0" />
        </radialGradient>
        <pattern
          id={`${id}-lattice`}
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0 H14 M0 0 V14" stroke="#e3ac52" strokeOpacity="0.09" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width="200" height="300" rx="14" fill={ref('bg')} />
      <rect width="200" height="300" rx="14" fill={ref('lattice')} />

      {/* Cadre double */}
      <rect x="7" y="7" width="186" height="286" rx="10" fill="none" stroke={ref('gold')} strokeWidth="3" />
      <rect x="15" y="15" width="170" height="270" rx="6" fill="none" stroke={ref('gold')} strokeWidth="0.8" />

      {/* Ornements d'angle */}
      {[
        [15, 15, 1, 1],
        [185, 15, -1, 1],
        [15, 285, 1, -1],
        [185, 285, -1, -1],
      ].map(([x, y, sx, sy]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke={ref('gold')}>
          <path d="M0 22 C0 8 8 0 22 0" strokeWidth="1.6" />
          <path d="M6 22 C6 12 12 6 22 6" strokeWidth="0.8" />
          <circle cx="11" cy="11" r="2.2" fill="#e3ac52" stroke="none" />
        </g>
      ))}

      {/* Losanges haut et bas */}
      <path d="M100 30 L108 40 L100 50 L92 40 Z" fill="none" stroke={ref('gold')} strokeWidth="1.2" />
      <path d="M100 250 L108 260 L100 270 L92 260 Z" fill="none" stroke={ref('gold')} strokeWidth="1.2" />

      {/* Éclipse et rayons */}
      <circle cx="100" cy="150" r="62" fill={ref('corona')} />
      <g stroke={ref('gold')} strokeWidth="1.4" strokeLinecap="round">
        {Array.from({ length: 16 }, (_, i) => {
          const angle = (i * Math.PI * 2) / 16;
          const long = i % 2 === 0;
          const inner = 44;
          const outer = long ? 62 : 54;
          return (
            <line
              key={i}
              x1={100 + Math.cos(angle) * inner}
              y1={150 + Math.sin(angle) * inner}
              x2={100 + Math.cos(angle) * outer}
              y2={150 + Math.sin(angle) * outer}
              opacity={long ? 0.9 : 0.5}
            />
          );
        })}
      </g>
      <circle cx="100" cy="150" r="36" fill={ref('gold')} />
      <circle cx="109" cy="144" r="34" fill="#09080d" />

      <text
        x="100"
        y="226"
        textAnchor="middle"
        fontFamily="Cinzel Variable, serif"
        fontSize="17"
        fontWeight="700"
        letterSpacing="7"
        fill={ref('gold')}
      >
        UMBRA
      </text>
    </svg>
  );
}

/** Pile de cartes face cachée, avec le nombre de cartes restantes. */
export function DeckPile({ count, label }: { count: number; label: string }) {
  const layers = Math.min(count, 4);
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-16" style={{ aspectRatio: '2 / 3' }}>
        {count === 0 ? (
          <div className="absolute inset-0 rounded-lg border border-dashed border-line" />
        ) : (
          Array.from({ length: layers }, (_, i) => (
            <CardBack
              key={i}
              className="absolute inset-0 size-full drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)]"
              // Chaque couche est légèrement décalée et tournée pour donner du volume à la pile.
              style={{ transform: `translate(${i * 2}px, ${-i * 2}px) rotate(${(i - 1) * 2}deg)` }}
            />
          ))
        )}
      </div>
      <div>
        <p className="font-display text-3xl font-bold tabular-nums text-gilded">{count}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}
