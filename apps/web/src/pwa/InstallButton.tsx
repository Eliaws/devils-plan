import { Download, Share, SquarePlus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Eclipse } from '../ui/brand.tsx';
import { Sheet } from '../ui/primitives.tsx';
import { promptInstall, useInstallMode } from './install.ts';

/** « Installer l'application » : invite du navigateur sur Android, aide pas à pas sur iPhone. */
export function InstallButton() {
  const mode = useInstallMode();
  const [showIosHelp, setShowIosHelp] = useState(false);
  if (mode === 'installed' || mode === 'unavailable') return null;

  const onClick = () => {
    if (mode === 'prompt') void promptInstall();
    else setShowIosHelp(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-3 text-left transition hover:bg-gold/10"
      >
        <Eclipse className="size-9 shrink-0" />
        <span className="flex-1">
          <span className="block font-medium">Installer l'application</span>
          <span className="block text-xs text-muted">Plein écran, sur ton écran d'accueil</span>
        </span>
        <Download className="size-5 text-gold" />
      </button>

      <Sheet open={showIosHelp} onClose={() => setShowIosHelp(false)} title="Installer Umbra sur iPhone">
        <ol className="mb-4 flex flex-col gap-3">
          <Step number={1}>
            Touche <Share className="mx-1 inline size-5 align-text-bottom text-ice" aria-label="Partager" /> Partager,
            dans la barre de Safari.
          </Step>
          <Step number={2}>
            Choisis <SquarePlus className="mx-1 inline size-5 align-text-bottom" aria-hidden />
            <strong className="font-semibold">« Sur l'écran d'accueil »</strong>, puis « Ajouter ».
          </Step>
          <Step number={3}>Ouvre Umbra depuis sa nouvelle icône : le jeu s'affiche en plein écran.</Step>
        </ol>
        <p className="mb-4 text-xs text-muted">
          Sur iPhone, c'est le seul moyen : Apple ne laisse pas les sites proposer l'installation eux-mêmes.
        </p>
      </Sheet>
    </>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-xl bg-raised p-3 text-sm leading-relaxed">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold font-semibold text-gold-ink">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}
