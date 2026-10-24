import type { EquipmentId, GameView, Plan, PlayerView, SlotIndex, SpecialId } from '@chasseurs/engine';
import type { RoomSnapshot } from '@chasseurs/protocol';
import { Coins, Eye, ScrollText, Trophy, Users, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Board } from '../components/Board.tsx';
import { CardTile } from '../components/CardTile.tsx';
import { EventList, OrderStrip, Scoreboard, toLines } from '../components/GameInfo.tsx';
import {
  CARD_SET_LABELS,
  cardImage,
  equipmentName,
  equipmentTarget,
  equipmentText,
  monsterName,
  SLOT_LABELS,
  specialName,
  specialTarget,
  specialText,
} from '../game/cards.ts';
import { makeNames } from '../game/describe.ts';
import { type PlanDraft, usePlanDraft } from '../game/plan-draft.ts';
import { actions, useStore } from '../net/store.ts';
import { Button, cx, Pill, Sheet, Stepper } from '../ui/primitives.tsx';
import { GameOver } from './GameOver.tsx';

const PHASE_LABELS = { bidding: 'Mises', planning: 'Plans', gameOver: 'Fin' } as const;

export function PlayerGame({ view, room, playerId }: { view: GameView; room: RoomSnapshot; playerId: string }) {
  const connected = useStore((s) => s.connected);
  const lastResolution = useStore((s) => s.lastResolution);
  const history = useStore((s) => s.history);
  const [sheet, setSheet] = useState<'players' | 'journal' | null>(null);

  const me = view.players.find((p) => p.id === playerId);
  if (!me) return null;
  const mySide = view.sides.find((s) => s.id === me.sideId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="pt-safe sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-4 pb-3 backdrop-blur">
        <div className="flex-1">
          <p className="text-xs text-muted">Manche {view.round}</p>
          <p className="font-semibold">{PHASE_LABELS[view.phase]}</p>
        </div>
        {!connected && <WifiOff className="size-4 text-blood" aria-label="Connexion perdue" />}
        <Pill title="Tes pièces">
          <Coins className="size-4 text-gold" />
          {me.coins}
        </Pill>
        <Pill title="Points de victoire">
          <Trophy className="size-4 text-gold" />
          {mySide?.score ?? 0}
        </Pill>
        <button
          type="button"
          onClick={() => setSheet('players')}
          className="grid size-10 place-items-center text-muted"
          aria-label="Joueurs et scores"
        >
          <Users className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setSheet('journal')}
          className="grid size-10 place-items-center text-muted"
          aria-label="Journal"
        >
          <ScrollText className="size-5" />
        </button>
      </header>

      {view.phase === 'gameOver' ? (
        <GameOver view={view} room={room} playerId={playerId} />
      ) : (
        <ActiveGame key={`${view.round}-${view.phase}`} view={view} me={me} />
      )}

      <Sheet open={sheet === 'players'} onClose={() => setSheet(null)} title="Scores">
        <Scoreboard view={view} me={playerId} />
        <p className="mt-4 mb-2 text-xs text-muted">
          {CARD_SET_LABELS[view.cardSet].name} · {view.monsterDeckCount} monstre(s) dans la pioche
        </p>
      </Sheet>

      <Sheet open={sheet === 'journal'} onClose={() => setSheet(null)} title="Journal">
        {history.length > 0 ? (
          <EventList lines={toLines([...history].reverse(), view, playerId)} />
        ) : (
          <p className="pb-4 text-sm text-muted">Les événements apparaîtront ici au fil de la partie.</p>
        )}
      </Sheet>

      <Sheet
        open={lastResolution !== null}
        onClose={actions.dismissResolution}
        title={`Résolution de la manche ${view.round - 1}`}
      >
        {lastResolution && <EventList lines={toLines(lastResolution, view, playerId)} animate />}
        <Button className="mt-6 mb-2 w-full" onClick={actions.dismissResolution}>
          Continuer
        </Button>
      </Sheet>
    </div>
  );
}

function ActiveGame({ view, me }: { view: GameView; me: PlayerView }) {
  const myPlan = view.players.find((p) => p.id === me.id)?.plan ?? null;
  const scouted = view.scouted !== null;
  const draft = usePlanDraft(myPlan, view.cardSet, scouted);
  const [editing, setEditing] = useState(false);
  const names = makeNames(view, me.id);

  const planning = view.phase === 'planning';
  const showPlanner = planning && (!me.hasPlanned || editing);

  return (
    <>
      <section className="px-4 pt-4">
        <Board
          view={view}
          scouted={view.scouted}
          onSelect={showPlanner ? draft.tapSlot : undefined}
          marks={showPlanner ? draft.marks : {}}
          nameOf={names.player}
        />
        {showPlanner && draft.targeting && (
          <p className="mt-2 text-center text-sm font-medium text-gold">{draft.missing}</p>
        )}
      </section>

      <section className="mt-4 px-4">
        <OrderStrip view={view} me={me.id} />
      </section>

      <section className="mt-4 flex-1 px-4 pb-4">
        {view.phase === 'bidding' && <BidPanel view={view} me={me} />}
        {showPlanner && <PlanPanel view={view} me={me} draft={draft} onDone={() => setEditing(false)} />}
        {planning && me.hasPlanned && !editing && myPlan && (
          <Waiting view={view} plan={myPlan} onEdit={() => setEditing(true)} />
        )}
      </section>
    </>
  );
}

// --- Mise ----------------------------------------------------------------------

function BidPanel({ view, me }: { view: GameView; me: PlayerView }) {
  const [amount, setAmount] = useState(me.bid ?? 0);
  const [editing, setEditing] = useState(!me.hasBid);
  const waiting = view.players.filter((p) => !p.hasBid);

  if (me.hasBid && !editing) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <p className="text-lg font-semibold">Mise envoyée : {me.bid} 🪙</p>
        <p className="mt-1 text-sm text-muted">
          En attente de {waiting.map((p) => p.name).join(', ') || 'la révélation'}…
        </p>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setEditing(true)}>
          Modifier ma mise
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Combien mises-tu ?</h2>
      <p className="mt-1 text-sm text-muted">La plus grosse mise joue en premier. Tout le monde perd sa mise.</p>
      <div className="my-6 flex justify-center">
        <Stepper value={amount} max={me.coins} onChange={setAmount} label="Mise" />
      </div>
      <Button
        className="w-full"
        onClick={async () => {
          if (await actions.act({ type: 'bid', amount })) setEditing(false);
        }}
      >
        Miser {amount} 🪙
      </Button>
    </div>
  );
}

// --- Plan ----------------------------------------------------------------------

function group<T extends string>(cards: T[]): { id: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

function PlanPanel({
  view,
  me,
  draft,
  onDone,
}: {
  view: GameView;
  me: PlayerView;
  draft: PlanDraft;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const { draft: d } = draft;
  const others = view.players.filter((p) => p.id !== me.id);
  const scouted = view.scouted !== null;
  const equipment = group<EquipmentId>(me.equipment ?? []);
  const specials = group<SpecialId>(me.specials ?? []);

  const submit = async () => {
    const plan = draft.toPlan();
    if (!plan) return;
    setBusy(true);
    if (await actions.act({ type: 'plan', plan })) onDone();
    setBusy(false);
  };

  const pickSpecial = (card: SpecialId) => {
    if (card === 'eclaireur') {
      void actions.act({ type: 'scout' });
      return;
    }
    draft.selectSpecial(card);
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="mb-2 text-sm text-muted">Équipement</h2>
        <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
          {equipment.map(({ id, count }) => (
            <CardTile
              key={id}
              id={id}
              name={equipmentName(id)}
              count={count}
              selected={d.equipment === id}
              onClick={() => draft.selectEquipment(id)}
            />
          ))}
        </div>
        {d.equipment && (
          <CardHint text={equipmentText(d.equipment, view.cardSet)} onZoom={() => setZoom(d.equipment)} />
        )}
        {d.equipment && equipmentTarget(d.equipment, view.cardSet) === 'slot-and-player' && (
          <PlayerPicker
            players={others}
            selected={d.targetPlayer}
            onSelect={(id) => draft.update({ targetPlayer: id })}
          />
        )}
      </div>

      {(specials.length > 0 || scouted) && (
        <div>
          <h2 className="mb-2 text-sm text-muted">Carte Spéciale (facultatif)</h2>
          {scouted ? (
            <p className="flex items-center gap-2 rounded-xl bg-raised px-3 py-2 text-sm text-arcane">
              <Eye className="size-4" /> L'éclaireur utilisé : les PV restants sont affichés.
            </p>
          ) : (
            <div className="scrollbar-none -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
              {specials.map(({ id, count }) => (
                <CardTile
                  key={id}
                  id={id}
                  name={id === 'eclaireur' ? `${specialName(id)} (immédiat)` : specialName(id)}
                  count={count}
                  accent="arcane"
                  selected={d.special === id}
                  disabled={specialTarget(id) === 'with-attack' && !draft.isAttack}
                  onClick={() => pickSpecial(id)}
                />
              ))}
            </div>
          )}
          {d.special && <CardHint text={specialText(d.special)} onZoom={() => setZoom(d.special)} />}
          {d.special && specialTarget(d.special) === 'player' && (
            <PlayerPicker
              players={others}
              selected={d.specialPlayer}
              onSelect={(id) => draft.update({ specialPlayer: id })}
            />
          )}
        </div>
      )}

      {draft.isAttack && me.coins > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
          <div>
            <p className="font-medium">Boost</p>
            <p className="text-sm text-muted">+1 dégât par pièce</p>
          </div>
          <Stepper value={d.boost} max={me.coins} onChange={(boost) => draft.update({ boost })} label="Boost" />
        </div>
      )}

      <div className="pb-safe sticky bottom-0 -mx-4 mt-auto bg-gradient-to-t from-bg via-bg to-transparent px-4 pt-4">
        <Button className="w-full" disabled={draft.missing !== null || busy} onClick={submit}>
          {draft.missing ?? 'Valider mon plan'}
        </Button>
      </div>

      <Sheet open={zoom !== null} onClose={() => setZoom(null)} title="Carte">
        {zoom && <img src={cardImage(zoom)} alt="" className="mx-auto mb-4 max-h-[60dvh] rounded-2xl" />}
      </Sheet>
    </div>
  );
}

function CardHint({ text, onZoom }: { text: string; onZoom: () => void }) {
  return (
    <div className="mt-2 flex items-start gap-3 rounded-xl bg-raised px-3 py-2.5 text-sm">
      <p className="flex-1">{text}</p>
      <button type="button" onClick={onZoom} className="shrink-0 text-xs text-muted underline underline-offset-2">
        Voir la carte
      </button>
    </div>
  );
}

function PlayerPicker({
  players,
  selected,
  onSelect,
}: {
  players: PlayerView[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset className="mt-2 flex flex-wrap gap-2">
      <legend className="sr-only">Joueur visé</legend>
      {players.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={selected === p.id}
          onClick={() => onSelect(p.id)}
          className={cx(
            'min-h-10 rounded-full border px-4 text-sm',
            selected === p.id ? 'border-arcane bg-arcane/15 text-arcane' : 'border-line bg-surface',
          )}
        >
          {p.name}
        </button>
      ))}
    </fieldset>
  );
}

function Waiting({ view, plan, onEdit }: { view: GameView; plan: Plan; onEdit: () => void }) {
  const waiting = view.players.filter((p) => !p.hasPlanned);
  const target = (slot: SlotIndex) => {
    const monster = view.board[slot];
    return monster ? monsterName(monster.id) : SLOT_LABELS[slot];
  };
  const parts = [
    plan.equipment &&
      `${equipmentName(plan.equipment.card)} → ${
        'slots' in plan.equipment ? plan.equipment.slots.map(target).join(' + ') : target(plan.equipment.slot)
      }`,
    plan.special && specialName(plan.special.card),
    plan.boost > 0 && `+${plan.boost} 🪙`,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-lg font-semibold">Plan envoyé</p>
      <p className="mt-1 text-sm">{parts.join(' · ') || "L'éclaireur seulement"}</p>
      <p className="mt-3 text-sm text-muted">En attente de {waiting.map((p) => p.name).join(', ')}…</p>
      <Button variant="secondary" className="mt-4 w-full" onClick={onEdit}>
        Modifier mon plan
      </Button>
    </div>
  );
}
