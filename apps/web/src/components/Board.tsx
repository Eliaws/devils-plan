import type { GameView, MonsterView, PendingEffect, ScoutEntry } from '@umbra/engine';
import { Clock, Droplet, Heart, Network, Skull, Snowflake } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cardImage, monsterName, SLOT_LABELS } from '../game/cards.ts';
import type { Tone } from '../game/describe.ts';
import { cx } from '../ui/primitives.tsx';
import { MonsterEffects } from './effects/MonsterEffects.tsx';

export interface SlotFlash {
  /** Change à chaque événement pour relancer l'animation. */
  key: number;
  tone: Tone;
  /** Texte flottant (« +15 », « Raté »…). */
  label?: string;
}

interface BoardProps {
  view: GameView;
  size?: 'sm' | 'lg';
  /** Rapport de L'éclaireur : PV restants connus. */
  scouted?: ScoutEntry[] | null;
  /** Mode ciblage : emplacements cliquables. */
  onSelect?: (slot: 0 | 1 | 2) => void;
  /** Badge affiché sur chaque emplacement sélectionné (ex. « 1 », « 2 », « ✓ »). */
  marks?: Partial<Record<number, string>>;
  flashes?: Partial<Record<number, SlotFlash>>;
  /** Noms des joueurs, pour les protections. */
  nameOf?: (id: string) => string;
}

export function Board({ view, size = 'sm', scouted, onSelect, marks = {}, flashes = {}, nameOf }: BoardProps) {
  return (
    <div className={cx('grid grid-cols-3', size === 'lg' ? 'gap-6' : 'gap-2')}>
      {view.board.map((monster, index) => {
        const slot = index as 0 | 1 | 2;
        return (
          <MonsterSlot
            key={slot}
            slot={slot}
            monster={monster}
            size={size}
            hpRemaining={scouted?.find((s) => s.slot === slot && s.monsterId === monster?.id)?.hpRemaining}
            pending={view.pending.filter((p) => (p.kind === 'charge' ? p.slot === slot : p.monsterId === monster?.id))}
            onSelect={onSelect && (() => onSelect(slot))}
            mark={marks[slot]}
            flash={flashes[slot]}
            nameOf={nameOf}
          />
        );
      })}
    </div>
  );
}

const FLASH_RING: Record<Tone, string> = {
  hit: 'ring-blood',
  kill: 'ring-blood',
  magic: 'ring-arcane',
  blocked: 'ring-ice',
  reward: 'ring-gold',
  info: 'ring-line',
};

function MonsterSlot({
  slot,
  monster,
  size,
  hpRemaining,
  pending,
  onSelect,
  mark,
  flash,
  nameOf,
}: {
  slot: 0 | 1 | 2;
  monster: MonsterView | null;
  size: 'sm' | 'lg';
  hpRemaining: number | undefined;
  pending: PendingEffect[];
  onSelect?: (() => void) | undefined;
  mark: string | undefined;
  flash: SlotFlash | undefined;
  nameOf: ((id: string) => string) | undefined;
}) {
  const large = size === 'lg';
  const content = (
    <>
      <div
        key={flash?.key}
        className={cx(
          'relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-raised ring-2 ring-transparent transition',
          flash && FLASH_RING[flash.tone],
          flash && (flash.tone === 'hit' || flash.tone === 'kill') && 'animate-shake',
          onSelect && 'ring-gold/40',
          mark && 'ring-gold!',
        )}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {monster ? (
            <motion.img
              key={monster.id}
              src={cardImage(monster.id)}
              alt={monsterName(monster.id)}
              className="absolute inset-0 size-full object-cover"
              initial={{ opacity: 0, scale: 0.9, rotateY: 90 }}
              animate={{ opacity: 1, scale: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.8, filter: 'grayscale(1)' }}
              transition={{ duration: 0.45 }}
              draggable={false}
            />
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 grid place-items-center text-faint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Skull className={large ? 'size-12' : 'size-6'} />
            </motion.div>
          )}
        </AnimatePresence>

        {monster && <MonsterEffects monster={monster} pending={pending} compact />}
        {monster && <StatusBadges monster={monster} pending={pending} large={large} nameOf={nameOf} />}

        {mark && (
          <span className="absolute inset-x-0 bottom-2 mx-auto grid size-8 place-items-center rounded-full bg-gold text-sm font-bold text-gold-ink shadow-lg">
            {mark}
          </span>
        )}
      </div>

      <div className={cx('mt-1.5 text-left leading-tight', large && 'mt-3')}>
        <div className={cx('truncate font-medium', large ? 'text-2xl' : 'text-[13px]')}>
          {monster ? monsterName(monster.id) : 'Vide'}
        </div>
        <div className={cx('flex items-center gap-1 text-muted tabular-nums', large ? 'text-xl' : 'text-xs')}>
          {monster ? (
            <>
              <Heart className={cx('text-blood', large ? 'size-5' : 'size-3')} fill="currentColor" />
              {hpRemaining !== undefined ? (
                <span>
                  <span className="font-semibold text-ink">{hpRemaining}</span> / {monster.maxHp}
                </span>
              ) : (
                <span>{monster.maxHp} PV</span>
              )}
            </>
          ) : (
            <span>{SLOT_LABELS[slot]}</span>
          )}
        </div>
      </div>
    </>
  );

  if (!onSelect) return <div>{content}</div>;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!monster}
      aria-pressed={Boolean(mark)}
      aria-label={`Cibler ${monster ? monsterName(monster.id) : SLOT_LABELS[slot]}`}
      className="block w-full text-left transition active:scale-[0.97] disabled:opacity-40"
    >
      {content}
    </button>
  );
}

function StatusBadges({
  monster,
  pending,
  large,
  nameOf,
}: {
  monster: MonsterView;
  pending: PendingEffect[];
  large: boolean;
  nameOf: ((id: string) => string) | undefined;
}) {
  const badges: { key: string; icon: typeof Snowflake; className: string; label: string }[] = [];
  if (monster.protectedBy) {
    badges.push({
      key: 'protected',
      icon: Snowflake,
      className: 'bg-ice/90 text-bg',
      label: `Protégé par ${nameOf?.(monster.protectedBy) ?? 'un joueur'}`,
    });
  }
  if (monster.frozen) badges.push({ key: 'frozen', icon: Snowflake, className: 'bg-ice/90 text-bg', label: 'Gelé' });
  if (monster.poisoned)
    badges.push({ key: 'poison', icon: Droplet, className: 'bg-venom/90 text-bg', label: 'Empoisonné' });
  if (monster.netOwnerId) badges.push({ key: 'net', icon: Network, className: 'bg-arcane/90 text-bg', label: 'Filet' });
  if (pending.length > 0) {
    badges.push({
      key: 'pending',
      icon: Clock,
      className: 'bg-gold/90 text-gold-ink',
      label: 'Effet au prochain tour',
    });
  }
  if (badges.length === 0) return null;
  return (
    <div className={cx('absolute top-1.5 right-1.5 flex flex-col gap-1', large && 'top-3 right-3 gap-2')}>
      {badges.map(({ key, icon: Icon, className, label }) => (
        <span
          key={key}
          title={label}
          className={cx('grid place-items-center rounded-full shadow', large ? 'size-10' : 'size-6', className)}
        >
          <Icon className={large ? 'size-5' : 'size-3.5'} aria-label={label} />
        </span>
      ))}
    </div>
  );
}
