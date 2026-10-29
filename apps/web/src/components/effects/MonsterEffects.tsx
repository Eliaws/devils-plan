// Effets visuels posés sur la carte d'un monstre, selon son état :
// givre (protection / gel), poison, filet, envoûtement, charge et morsure à venir.
// Tout est en SVG / CSS : net à toutes les tailles et très léger.

import type { MonsterView, PendingEffect } from '@umbra/engine';
import { Swords } from 'lucide-react';
import { motion } from 'motion/react';
import { type ReactNode, useId } from 'react';
import { cx } from '../../ui/primitives.tsx';

export function MonsterEffects({
  monster,
  pending,
  compact = false,
}: {
  monster: MonsterView;
  pending: PendingEffect[];
  /** Version allégée pour les petites cartes du téléphone. */
  compact?: boolean;
}) {
  const charge = pending.filter((p) => p.kind === 'charge').reduce((sum, p) => sum + p.amount, 0);
  return (
    <>
      {monster.poisoned && <Poison compact={compact} />}
      {monster.netOwnerId && <Net />}
      {pending.some((p) => p.kind === 'curse') && <Curse compact={compact} />}
      {pending.some((p) => p.kind === 'bite') && <Bite />}
      {(monster.protectedBy || monster.frozen) && <Frost compact={compact} />}
      {charge > 0 && <Charge amount={charge} compact={compact} />}
    </>
  );
}

/** Calque qui apparaît en fondu par-dessus l'illustration. */
function Layer({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <motion.div
      className={cx('pointer-events-none absolute inset-0', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      aria-hidden
    >
      {children}
    </motion.div>
  );
}

// --- Givre -------------------------------------------------------------------

/** Éclats de glace aux quatre coins, voile bleuté et flocons scintillants. */
function Frost({ compact }: { compact: boolean }) {
  const id = useId();
  const shard = 'M0 0 L26 0 L15 9 L30 13 L12 19 L19 34 L5 25 L0 40 Z';
  const corners = [
    'translate(0 0)',
    'translate(100 0) scale(-1 1)',
    'translate(0 150) scale(1 -1)',
    'translate(100 150) scale(-1 -1)',
  ];
  const flakes = compact
    ? [[28, 40, 0]]
    : [
        [24, 38, 0],
        [74, 52, 0.8],
        [30, 112, 1.5],
        [70, 120, 0.4],
      ];
  return (
    <Layer className="shadow-[inset_0_0_30px_6px_rgba(94,177,239,0.75)]">
      <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(186,225,255,0.28),rgba(94,177,239,0.08)_45%,rgba(186,225,255,0.25))]" />
      <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-ice`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#5eb1ef" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {corners.map((transform) => (
          <g key={transform} transform={transform}>
            <path d={shard} fill={`url(#${id}-ice)`} stroke="#e6f4ff" strokeWidth="0.6" strokeOpacity="0.9" />
            <path d="M0 0 L19 23 M0 0 L24 6" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.8" />
          </g>
        ))}
      </svg>
      {flakes.map(([x, y, delay]) => (
        <Snowflake key={`${x}-${y}`} x={x ?? 0} y={y ?? 0} delay={delay ?? 0} />
      ))}
    </Layer>
  );
}

function Snowflake({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-10 -10 20 20"
      className="absolute size-[12%] animate-twinkle motion-reduce:animate-none"
      style={{ left: `${x}%`, top: `${(y / 150) * 100}%`, animationDelay: `${delay}s` }}
    >
      <g stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round">
        {[0, 60, 120].map((angle) => (
          <g key={angle} transform={`rotate(${angle})`}>
            <line x1="0" y1="-8" x2="0" y2="8" />
            <line x1="-3" y1="-6" x2="0" y2="-3.5" />
            <line x1="3" y1="-6" x2="0" y2="-3.5" />
          </g>
        ))}
      </g>
    </svg>
  );
}

// --- Poison ------------------------------------------------------------------

const BUBBLES = [
  { left: 12, size: 9, delay: 0, duration: 2.6 },
  { left: 30, size: 6, delay: 1.1, duration: 3.1 },
  { left: 48, size: 11, delay: 0.5, duration: 2.8 },
  { left: 66, size: 7, delay: 1.7, duration: 2.4 },
  { left: 80, size: 10, delay: 0.9, duration: 3.3 },
  { left: 22, size: 5, delay: 2.1, duration: 2.9 },
];

/** Brume verte qui monte du bas de la carte, et bulles qui éclatent. */
function Poison({ compact }: { compact: boolean }) {
  const bubbles = compact ? BUBBLES.slice(0, 3) : BUBBLES;
  return (
    <Layer>
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(76,195,138,0.55),rgba(76,195,138,0.15)_40%,transparent_65%)]" />
      {bubbles.map((bubble) => (
        <span
          key={bubble.left}
          className="absolute bottom-[4%] animate-bubble rounded-full border border-[#b9f5d3]/70 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.7),rgba(76,195,138,0.45)_45%,rgba(30,110,70,0.35))] motion-reduce:animate-none"
          style={{
            left: `${bubble.left}%`,
            width: `${bubble.size}%`,
            aspectRatio: '1',
            animationDelay: `${bubble.delay}s`,
            animationDuration: `${bubble.duration}s`,
          }}
        />
      ))}
    </Layer>
  );
}

// --- Filet magique -----------------------------------------------------------

/** Mailles lumineuses tendues sur la carte. */
function Net() {
  const id = useId();
  return (
    <Layer className="shadow-[inset_0_0_24px_2px_rgba(168,127,240,0.6)]">
      <svg viewBox="0 0 100 150" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <pattern id={`${id}-mesh`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M0 0 H16 M0 0 V16" stroke="#d9c6ff" strokeWidth="0.9" strokeOpacity="0.75" />
            <circle cx="0" cy="0" r="1.2" fill="#ffffff" />
          </pattern>
        </defs>
        <rect
          width="100"
          height="150"
          fill={`url(#${id}-mesh)`}
          className="animate-breathe motion-reduce:animate-none"
        />
      </svg>
    </Layer>
  );
}

// --- Envoûtement -------------------------------------------------------------

/** Aura violette, cercle de runes qui tourne et notes de musique (le chant de la Sirène). */
function Curse({ compact }: { compact: boolean }) {
  const glyphs = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <Layer className="shadow-[inset_0_0_36px_8px_rgba(168,127,240,0.7)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(168,127,240,0.35),transparent_65%)]" />
      {/* Les cercles tournent en tant que boîtes HTML : rotation fiable autour de leur centre. */}
      <div className="absolute top-1/2 left-1/2 aspect-square w-[86%] -translate-x-1/2 -translate-y-1/2">
        <svg
          aria-hidden="true"
          viewBox="-50 -50 100 100"
          className="absolute inset-0 size-full animate-spin-slow motion-reduce:animate-none"
        >
          <circle r="40" fill="none" stroke="#c9b0ff" strokeWidth="1" strokeDasharray="3 5" strokeOpacity="0.85" />
          {glyphs.map((angle) => (
            <g key={angle} transform={`rotate(${angle}) translate(0 -40)`}>
              <path d="M-2.5 -3 L0 3 L2.5 -3 M-2 0 H2" stroke="#efe6ff" strokeWidth="1.1" fill="none" />
            </g>
          ))}
        </svg>
        <svg
          aria-hidden="true"
          viewBox="-50 -50 100 100"
          className="absolute inset-0 size-full animate-spin-rev motion-reduce:animate-none"
        >
          <circle r="30" fill="none" stroke="#a87ff0" strokeWidth="0.9" strokeOpacity="0.8" />
          <path d="M0 -30 L26 15 L-26 15 Z" fill="none" stroke="#c9b0ff" strokeWidth="0.7" strokeOpacity="0.7" />
        </svg>
      </div>
      {!compact &&
        [
          { note: '♪', left: 14, top: 22, delay: 0 },
          { note: '♫', left: 76, top: 30, delay: 1.2 },
          { note: '♪', left: 70, top: 74, delay: 2.1 },
        ].map(({ note, left, top, delay }) => (
          <span
            key={`${left}-${top}`}
            className="absolute animate-float-note text-[2vw] text-[#e7dbff] drop-shadow-[0_0_6px_rgba(168,127,240,0.9)] motion-reduce:animate-none"
            style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
          >
            {note}
          </span>
        ))}
    </Layer>
  );
}

// --- Morsure -----------------------------------------------------------------

/** Deux traces de crocs qui saignent : la suite de la Morsure arrive au prochain tour. */
function Bite() {
  return (
    <Layer>
      <svg viewBox="0 0 100 150" className="absolute inset-0 size-full" aria-hidden="true">
        {[38, 62].map((x, i) => (
          <g key={x}>
            <path
              d={`M${x - 5} 30 Q${x} 50 ${x + 5} 30 Q${x} 35 ${x - 5} 30 Z`}
              fill="#5c070b"
              stroke="#ff6369"
              strokeWidth="0.9"
            />
            <rect
              x={x - 1}
              y="44"
              width="2"
              height="22"
              rx="1"
              fill="#e5484d"
              className="animate-drip motion-reduce:animate-none"
              style={{ transformBox: 'fill-box', transformOrigin: 'top', animationDelay: `${i * 0.7}s` }}
            />
          </g>
        ))}
      </svg>
    </Layer>
  );
}

// --- Charge de l'abomination -------------------------------------------------

/** Lueur rouge qui pulse et dégâts annoncés pour le prochain tour. */
function Charge({ amount, compact }: { amount: number; compact: boolean }) {
  return (
    <Layer className="animate-glow-red rounded-[inherit] motion-reduce:animate-none">
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(229,72,77,0.45),transparent)]" />
      <span
        className={cx(
          'absolute right-[6%] bottom-[5%] flex items-center gap-1 rounded-full bg-blood font-bold text-white shadow-lg',
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-3 py-1 text-[1.1vw]',
        )}
      >
        <Swords className={compact ? 'size-3' : 'size-[1.1vw]'} />
        {amount}
      </span>
    </Layer>
  );
}
