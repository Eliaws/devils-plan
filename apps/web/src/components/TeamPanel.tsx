import type { EquipmentId, GameView, PlayerView, SpecialId } from '@umbra/engine';
import { ChevronDown, Coins } from 'lucide-react';
import { equipmentName, specialName } from '../game/cards.ts';
import { makeNames, sideLabel } from '../game/describe.ts';
import { planSummary } from '../game/plan-summary.ts';
import { cx } from '../ui/primitives.tsx';

/**
 * Mode Équipe : ce que font les coéquipiers (mise, plan) et leurs cartes, pour se coordonner.
 * Le serveur n'envoie ces informations qu'aux membres de l'équipe.
 */
export function TeamPanel({ view, me }: { view: GameView; me: PlayerView }) {
  const side = view.sides.find((s) => s.id === me.sideId);
  const teammates = view.players.filter((p) => p.sideId === me.sideId && p.id !== me.id);
  if (!side?.isTeam || teammates.length === 0) return null;
  const names = makeNames(view, me.id);

  return (
    <section className="mt-4 px-4" aria-label="Ton équipe">
      <h2 className="mb-2 text-sm text-muted">
        Ton équipe · <span className="text-ink">{sideLabel(side)}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {teammates.map((mate) => (
          <li key={mate.id}>
            <details className="group rounded-xl border border-line bg-surface">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{mate.name}</span>
                  <span className="block truncate text-sm text-muted">{status(mate, view, names.player)}</span>
                </span>
                <span className="flex items-center gap-1 text-sm text-gold tabular-nums" title="Pièces">
                  <Coins className="size-3.5" />
                  {mate.coins}
                </span>
                <ChevronDown className="size-4 text-muted transition group-open:rotate-180" aria-hidden />
              </summary>
              <div className="flex flex-wrap gap-1.5 border-t border-line px-4 py-3">
                {group(mate.equipment ?? []).map(({ id, count }) => (
                  <CardChip key={id} label={equipmentName(id as EquipmentId)} count={count} kind="equipment" />
                ))}
                {group(mate.specials ?? []).map(({ id, count }) => (
                  <CardChip key={id} label={specialName(id as SpecialId)} count={count} kind="special" />
                ))}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function status(mate: PlayerView, view: GameView, nameOf: (id: string) => string): string {
  if (mate.isAbsent) return 'Absent : ne joue plus jusqu’à son retour';
  if (!mate.isParticipant) return 'Reprend à la prochaine manche';
  if (view.phase === 'bidding') return mate.hasBid ? `Mise ${mate.bid ?? 0} 🪙` : 'Réfléchit à sa mise…';
  if (view.phase === 'planning') return mate.plan ? planSummary(mate.plan, view, nameOf) : 'Prépare son plan…';
  if (view.phase === 'recap') return mate.isReady ? 'Prêt pour la suite' : 'Lit le récapitulatif…';
  return '';
}

function group(cards: string[]): { id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

function CardChip({ label, count, kind }: { label: string; count: number; kind: 'equipment' | 'special' }) {
  return (
    <span
      className={cx(
        'rounded-full border px-2.5 py-1 text-xs',
        kind === 'equipment' ? 'border-line bg-raised' : 'border-arcane/40 bg-arcane/10 text-arcane',
      )}
    >
      {label}
      {count > 1 && <span className="text-muted"> ×{count}</span>}
    </span>
  );
}
