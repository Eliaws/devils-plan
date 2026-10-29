import type { GameView, MonsterView, PendingEffect } from '@umbra/engine';
import { Clock, Droplet, Heart, Network, Skull, Snowflake } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cardImage, monsterName } from '../../game/cards.ts';
import type { Tone } from '../../game/describe.ts';
import { Eclipse } from '../../ui/brand.tsx';
import { cx } from '../../ui/primitives.tsx';
import type { SlotFlash } from '../Board.tsx';
import { CardBack } from '../effects/CardBack.tsx';
import { Embers } from '../effects/Embers.tsx';
import { MonsterEffects } from '../effects/MonsterEffects.tsx';

const SLOT_KEYS = ['gauche', 'centre', 'droite'];

/** Les trois monstres en grand, avec les effets de combat (écran principal). */
export function MonsterStage({
  view,
  flashes,
  nameOf,
}: {
  view: GameView;
  flashes: Partial<Record<number, SlotFlash>>;
  nameOf: (id: string) => string;
}) {
  return (
    <div className="flex items-start justify-center gap-[3vw]">
      {view.board.map((monster, slot) => (
        <StageCard
          key={SLOT_KEYS[slot]}
          monster={monster}
          flash={flashes[slot]}
          pending={view.pending.filter((p) => (p.kind === 'charge' ? p.slot === slot : p.monsterId === monster?.id))}
          nameOf={nameOf}
        />
      ))}
    </div>
  );
}

const GLOW: Record<Tone, string> = {
  hit: '0 0 60px 6px rgba(229,72,77,0.55)',
  kill: '0 0 90px 14px rgba(229,72,77,0.8)',
  magic: '0 0 60px 6px rgba(168,127,240,0.55)',
  blocked: '0 0 60px 6px rgba(94,177,239,0.55)',
  reward: '0 0 60px 6px rgba(227,172,82,0.6)',
  info: '0 0 40px 2px rgba(227,172,82,0.25)',
};

const LABEL_COLOR: Record<Tone, string> = {
  hit: 'text-blood',
  kill: 'text-gold',
  magic: 'text-arcane',
  blocked: 'text-ice',
  reward: 'text-gold',
  info: 'text-ink',
};

function StageCard({
  monster,
  flash,
  pending,
  nameOf,
}: {
  monster: MonsterView | null;
  flash: SlotFlash | undefined;
  pending: PendingEffect[];
  nameOf: (id: string) => string;
}) {
  const killed = flash?.tone === 'kill';
  const hit = flash?.tone === 'hit' || killed;

  return (
    <div className="flex flex-col items-center" style={{ width: 'min(15vw, 24dvh)' }}>
      <div className="relative aspect-[2/3] w-full [perspective:1200px]">
        <AnimatePresence mode="popLayout" initial={false}>
          {monster ? (
            <motion.div
              key={monster.id}
              className="absolute inset-0 rounded-2xl [transform-style:preserve-3d]"
              initial={{ rotateY: 180 }}
              animate={{
                rotateY: 0,
                boxShadow: flash ? GLOW[flash.tone] : '0 25px 50px -20px rgba(0,0,0,0.9)',
              }}
              exit={{ opacity: 0, y: 40, scale: 0.85 }}
              transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {/* Face : l'illustration et ses effets */}
              <motion.div
                className={cx(
                  'absolute inset-0 overflow-hidden rounded-2xl [backface-visibility:hidden]',
                  hit && 'animate-shake',
                )}
                animate={{ filter: killed ? 'grayscale(1) brightness(0.55)' : 'grayscale(0) brightness(1)' }}
                transition={{ duration: 0.5 }}
              >
                <img src={cardImage(monster.id)} alt={monsterName(monster.id)} className="size-full object-cover" />
                <MonsterEffects monster={monster} pending={pending} />
                {hit && (
                  <motion.div
                    key={flash?.key}
                    className="absolute inset-0 bg-[radial-gradient(circle,rgba(229,72,77,0.65)_0%,transparent_70%)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.7 }}
                  />
                )}
                {hit && <Slash flashKey={flash?.key ?? 0} />}
                {killed && (
                  <motion.div
                    className="absolute inset-0 grid place-items-center"
                    initial={{ scale: 2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                  >
                    <Skull className="size-[40%] text-ink drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]" />
                  </motion.div>
                )}
                <Badges monster={monster} pending={pending} nameOf={nameOf} />
              </motion.div>
              {/* Dos : visible pendant le retournement d'un monstre qui surgit */}
              <div className="absolute inset-0 overflow-hidden rounded-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <CardBack className="size-full" />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 grid place-items-center rounded-2xl border border-line/60 bg-surface/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Eclipse className="size-1/3 opacity-30" />
            </motion.div>
          )}
        </AnimatePresence>

        {killed && flash && <Embers burstKey={flash.key} />}

        {/* Pas d'animation de sortie : le texte est remplacé dès l'image suivante, sans jamais s'empiler. */}
        {flash?.label && (
          <motion.span
            key={flash.key}
            className={cx(
              'pointer-events-none absolute inset-x-0 top-1/3 z-10 text-center font-display text-[5vw] font-bold drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]',
              LABEL_COLOR[flash.tone],
            )}
            initial={{ y: 30, opacity: 0, scale: 0.6 }}
            animate={{ y: -30, opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            {flash.label}
          </motion.span>
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="font-display text-[1.5vw] leading-tight font-semibold tracking-wide text-balance">
          {monster ? monsterName(monster.id) : '—'}
        </p>
        {monster && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[1.3vw] text-muted tabular-nums">
            <Heart className="size-[1.2vw] text-blood" fill="currentColor" />
            {monster.maxHp} PV
          </p>
        )}
      </div>
    </div>
  );
}

/** Deux traits de griffe qui zèbrent la carte touchée. */
function Slash({ flashKey }: { flashKey: number }) {
  return (
    <svg key={flashKey} viewBox="0 0 100 150" className="absolute inset-0 size-full" aria-hidden>
      {[0, 1].map((i) => (
        <motion.line
          key={i}
          x1={15 + i * 18}
          y1={20}
          x2={70 + i * 18}
          y2={130}
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: [1, 1, 0] }}
          transition={{ duration: 0.45, delay: i * 0.08 }}
        />
      ))}
    </svg>
  );
}

function Badges({
  monster,
  pending,
  nameOf,
}: {
  monster: MonsterView;
  pending: PendingEffect[];
  nameOf: (id: string) => string;
}) {
  const badges: { key: string; icon: typeof Snowflake; className: string; label: string }[] = [];
  if (monster.protectedBy) {
    badges.push({
      key: 'protected',
      icon: Snowflake,
      className: 'bg-ice text-bg',
      label: `Protégé par ${nameOf(monster.protectedBy)}`,
    });
  }
  if (monster.frozen) badges.push({ key: 'frozen', icon: Snowflake, className: 'bg-ice text-bg', label: 'Gelé' });
  if (monster.poisoned)
    badges.push({ key: 'poison', icon: Droplet, className: 'bg-venom text-bg', label: 'Empoisonné' });
  if (monster.netOwnerId) {
    badges.push({
      key: 'net',
      icon: Network,
      className: 'bg-arcane text-bg',
      label: `Filet de ${nameOf(monster.netOwnerId)}`,
    });
  }
  if (pending.length > 0) {
    badges.push({ key: 'pending', icon: Clock, className: 'bg-gold text-gold-ink', label: 'Effet au prochain tour' });
  }
  return (
    <div className="absolute top-[4%] left-[5%] flex flex-col gap-2">
      {badges.map(({ key, icon: Icon, className, label }) => (
        <motion.span
          key={key}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cx(
            'flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-[0.9vw] font-semibold shadow-lg',
            className,
          )}
        >
          <Icon className="size-[1.2vw]" aria-hidden />
          {label}
        </motion.span>
      ))}
    </div>
  );
}
