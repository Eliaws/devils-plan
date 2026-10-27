import { CARD_SETS, MIN_PLAYERS, TEAM_MODE_MIN_PLAYERS } from '@umbra/engine';
import { type RoomSnapshot, TEAMS } from '@umbra/protocol';
import { Check, Copy, Crown, QrCode, Share2, Tv } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { CARD_SET_LABELS } from '../game/cards.ts';
import { actions } from '../net/store.ts';
import { navigate, paths } from '../router.ts';
import { Logo } from '../ui/brand.tsx';
import { Button, cx, Presence, Sheet } from '../ui/primitives.tsx';

export function Lobby({ room, playerId }: { room: RoomSnapshot; playerId: string }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === playerId;
  const me = room.players.find((p) => p.id === playerId);
  const count = room.players.length;
  const missing = Math.max(0, MIN_PLAYERS - count);
  const teamsAllowed = count >= TEAM_MODE_MIN_PLAYERS;
  const invite = paths.invite(room.code);
  const canShare = typeof navigator.share === 'function';

  const share = async () => {
    if (canShare) {
      await navigator.share({ title: 'Umbra', text: `Rejoins la partie ${room.code}`, url: invite }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(invite);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = async () => {
    if (await actions.leave()) navigate(paths.home());
  };

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <Logo size="sm" className="mx-auto mt-2" />
      <header className="mt-4 rounded-2xl border border-line bg-surface p-5 text-center">
        <p className="text-sm text-muted">Code de la partie</p>
        <p className="mt-1 font-display text-5xl font-bold tracking-[0.25em] text-gilded">{room.code}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={share}>
            {copied ? (
              <Check className="size-4" />
            ) : canShare ? (
              <Share2 className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? 'Lien copié' : 'Inviter'}
          </Button>
          <Button variant="secondary" className="min-h-10 px-4 text-sm" onClick={() => setShowQr(true)}>
            <QrCode className="size-4" /> QR code
          </Button>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-2 flex items-baseline justify-between text-sm text-muted">
          <span>Chasseurs</span>
          <span className="tabular-nums">{count} / 12</span>
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {room.players.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Presence online={p.connected} />
              <span className={cx('flex-1 truncate', p.id === playerId && 'font-semibold')}>
                {p.name}
                {p.id === playerId && <span className="text-muted"> (toi)</span>}
              </span>
              {p.teamId && <span className="text-xs text-muted">{TEAMS.find((t) => t.id === p.teamId)?.name}</span>}
              {p.id === room.hostId && <Crown className="size-4 text-gold" aria-label="Hôte" />}
            </li>
          ))}
        </ul>
      </section>

      {(teamsAllowed || me?.teamId) && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm text-muted">Ton équipe (3 joueurs max)</h2>
          <div className="flex flex-wrap gap-2">
            {[{ id: null, name: 'Solo' }, ...TEAMS].map((team) => {
              const size = room.players.filter((p) => p.teamId === team.id).length;
              const selected = (me?.teamId ?? null) === team.id;
              return (
                <button
                  key={team.id ?? 'solo'}
                  type="button"
                  onClick={() => actions.setTeam(team.id)}
                  disabled={!selected && team.id !== null && size >= 3}
                  className={cx(
                    'min-h-10 rounded-full border px-4 text-sm transition disabled:opacity-30',
                    selected ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface',
                  )}
                >
                  {team.name}
                  {team.id && size > 0 && <span className="ml-1 text-muted">{size}</span>}
                </button>
              );
            })}
          </div>
          {!teamsAllowed && <p className="mt-2 text-xs text-blood">Les équipes demandent 6 joueurs ou plus.</p>}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm text-muted">Version des cartes</h2>
        <div className="grid grid-cols-2 gap-2">
          {CARD_SETS.map((set) => {
            const selected = room.settings.cardSet === set;
            return (
              <button
                key={set}
                type="button"
                disabled={!isHost}
                onClick={() => actions.setCardSet(set)}
                className={cx(
                  'rounded-xl border p-3 text-left transition',
                  selected ? 'border-gold bg-gold/10' : 'border-line bg-surface',
                  !isHost && !selected && 'opacity-40',
                )}
              >
                <span className={cx('block text-sm font-medium', selected && 'text-gold')}>
                  {CARD_SET_LABELS[set].name}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{CARD_SET_LABELS[set].description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        {isHost ? (
          <Button onClick={() => actions.start()} disabled={missing > 0}>
            {missing > 0 ? `Encore ${missing} joueur${missing > 1 ? 's' : ''}` : 'Lancer la partie'}
          </Button>
        ) : (
          <p className="py-3 text-center text-muted">En attente du lancement par l'hôte…</p>
        )}
        <div className="flex justify-between">
          <Button variant="ghost" className="min-h-10 px-2 text-sm" onClick={leave}>
            Quitter
          </Button>
          <a
            href={paths.table(room.code)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-2 px-2 text-sm text-muted hover:text-ink"
          >
            <Tv className="size-4" /> Écran de table
          </a>
        </div>
      </div>

      <Sheet open={showQr} onClose={() => setShowQr(false)} title={`Rejoindre ${room.code}`}>
        <div className="mx-auto mb-4 w-fit rounded-2xl bg-white p-4">
          <QRCodeSVG value={invite} size={220} />
        </div>
        <p className="mb-4 text-center text-sm text-muted">Scanne avec l'appareil photo du téléphone.</p>
      </Sheet>
    </main>
  );
}
