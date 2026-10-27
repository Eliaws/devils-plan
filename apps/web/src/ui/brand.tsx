import { cx } from './primitives.tsx';

/** Éclipse : un disque doré recouvert par l'ombre (umbra). */
export function Eclipse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="umbra-corona" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="#e3ac52" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#e3ac52" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="umbra-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6dca3" />
          <stop offset="100%" stopColor="#c98a35" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="31" fill="url(#umbra-corona)" />
      <circle cx="32" cy="32" r="19" fill="url(#umbra-sun)" />
      <circle cx="37" cy="29" r="18" fill="#08080c" />
    </svg>
  );
}

/** Logo complet : éclipse + « UMBRA ». */
export function Logo({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: { icon: 'size-7', text: 'text-lg tracking-[0.25em]' },
    md: { icon: 'size-12', text: 'text-4xl tracking-[0.2em]' },
    lg: { icon: 'size-20', text: 'text-7xl tracking-[0.2em]' },
  }[size];
  return (
    <span className={cx('inline-flex items-center gap-3', className)}>
      <Eclipse className={sizes.icon} />
      <span className={cx('font-display font-bold text-gilded', sizes.text)}>UMBRA</span>
    </span>
  );
}
