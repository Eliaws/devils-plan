import { Minus, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-gold text-gold-ink font-semibold hover:brightness-110 disabled:bg-raised disabled:text-faint',
  secondary: 'bg-raised text-ink border border-line hover:border-faint disabled:text-faint',
  ghost: 'text-muted hover:text-ink disabled:text-faint',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Sélecteur numérique avec gros boutons, utilisable au pouce. */
export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const button = 'grid size-12 place-items-center rounded-xl bg-raised border border-line disabled:opacity-30';
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={button}
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Moins (${label})`}
      >
        <Minus className="size-5" />
      </button>
      <output className="min-w-10 text-center text-3xl font-semibold tabular-nums" aria-label={label}>
        {value}
      </output>
      <button
        type="button"
        className={button}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Plus (${label})`}
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

export function Pill({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-sm font-medium tabular-nums',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Panneau qui monte du bas de l'écran (mobile), centré sur grand écran. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        // Pendant la fermeture, le panneau ne doit plus intercepter les touches.
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Fermer"
            className="pointer-events-auto absolute inset-0 bg-black/70"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="pb-safe pointer-events-auto relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-5 pt-3 sm:rounded-3xl sm:border"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', pointerEvents: 'none' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
            <h2 className="mb-4 text-lg font-semibold">{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Point vert/gris indiquant si un joueur est connecté. */
export function Presence({ online }: { online: boolean }) {
  return (
    <span
      className={cx('inline-block size-2 shrink-0 rounded-full', online ? 'bg-venom' : 'bg-faint')}
      role="img"
      aria-label={online ? 'Connecté' : 'Déconnecté'}
    />
  );
}
