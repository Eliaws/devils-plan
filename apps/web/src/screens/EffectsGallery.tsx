// Page de développement (/dev/effets) : tous les effets visuels sur une même page.

import type { MonsterId, MonsterView, PendingEffect } from '@umbra/engine';
import { MONSTERS } from '@umbra/engine';
import { useState } from 'react';
import { CardBack, DeckPile } from '../components/effects/CardBack.tsx';
import { Embers } from '../components/effects/Embers.tsx';
import { MonsterEffects } from '../components/effects/MonsterEffects.tsx';
import { cardImage } from '../game/cards.ts';
import { Logo } from '../ui/brand.tsx';
import { Button } from '../ui/primitives.tsx';

const monster = (id: MonsterId, patch: Partial<MonsterView> = {}): MonsterView => ({
  id,
  maxHp: MONSTERS[id].hp,
  frozen: false,
  poisoned: false,
  netOwnerId: null,
  protectedBy: null,
  ...patch,
});

const SAMPLES: { title: string; monster: MonsterView; pending: PendingEffect[] }[] = [
  { title: 'Souffle de glace', monster: monster('golem', { protectedBy: 'p1' }), pending: [] },
  { title: 'Poison', monster: monster('zombie', { poisoned: true }), pending: [] },
  { title: 'Filet magique', monster: monster('loup-garou', { netOwnerId: 'p1' }), pending: [] },
  {
    title: 'Envoûtement',
    monster: monster('sirene'),
    pending: [{ kind: 'curse', ownerId: 'p1', round: 2, monsterId: 'sirene' }],
  },
  {
    title: "Charge de l'abomination",
    monster: monster('frankenstein'),
    pending: [{ kind: 'charge', ownerId: 'p1', round: 2, slot: 0, amount: 8, marked: false }],
  },
  {
    title: 'Morsure (suite)',
    monster: monster('vampire'),
    pending: [{ kind: 'bite', ownerId: 'p1', round: 2, monsterId: 'vampire' }],
  },
];

export function EffectsGallery() {
  const [burst, setBurst] = useState(0);
  return (
    <main className="min-h-dvh px-8 py-8">
      <Logo size="sm" />
      <h1 className="mt-6 font-display text-3xl font-bold">Galerie des effets</h1>

      <section className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-8">
        {SAMPLES.map(({ title, monster: m, pending }) => (
          <figure key={title}>
            <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
              <img src={cardImage(m.id)} alt="" className="size-full object-cover" />
              <MonsterEffects monster={m} pending={pending} />
            </div>
            <figcaption className="mt-2 text-center text-sm text-muted">{title}</figcaption>
          </figure>
        ))}

        <figure>
          <div className="relative aspect-[2/3] overflow-hidden rounded-2xl">
            <CardBack className="size-full" />
          </div>
          <figcaption className="mt-2 text-center text-sm text-muted">Dos de carte</figcaption>
        </figure>

        <figure>
          <div className="relative aspect-[2/3] overflow-visible rounded-2xl">
            <img src={cardImage('yeti')} alt="" className="size-full rounded-2xl object-cover grayscale" />
            {burst > 0 && <Embers burstKey={burst} />}
          </div>
          <figcaption className="mt-2 flex justify-center">
            <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => setBurst((b) => b + 1)}>
              Étincelles
            </Button>
          </figcaption>
        </figure>
      </section>

      <h2 className="mt-10 text-sm text-muted">Version compacte (téléphone)</h2>
      <section className="mt-3 flex flex-wrap gap-3">
        {SAMPLES.map(({ title, monster: m, pending }) => (
          <div key={title} className="relative aspect-[2/3] w-28 overflow-hidden rounded-xl">
            <img src={cardImage(m.id)} alt="" className="size-full object-cover" />
            <MonsterEffects monster={m} pending={pending} compact />
          </div>
        ))}
      </section>

      <section className="mt-10">
        <DeckPile count={9} label="monstres tapis dans l'ombre" />
      </section>
    </main>
  );
}
