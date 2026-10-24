import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '@chasseurs/protocol';
import { Tv } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { actions, lastName, useStore } from '../net/store.ts';
import { navigate, paths } from '../router.ts';
import { Button } from '../ui/primitives.tsx';

export function Home({ initialCode }: { initialCode?: string | undefined }) {
  const [name, setName] = useState(lastName);
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const lost = useStore((s) => s.lost);
  const connected = useStore((s) => s.connected);

  const trimmed = name.trim();
  const validCode = code.length === ROOM_CODE_LENGTH;

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const created = await actions.createAndJoin(trimmed);
      if (created) navigate(paths.play(created));
    });

  const join = (event?: FormEvent) => {
    event?.preventDefault();
    if (!trimmed || !validCode) return;
    void run(async () => {
      if (await actions.join(code, trimmed)) navigate(paths.play(code));
    });
  };

  const createTable = () =>
    run(async () => {
      const created = await actions.createTable();
      if (created) navigate(paths.table(created));
    });

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col px-6">
      <header className="mt-[12dvh] mb-10">
        <p className="text-sm font-medium tracking-[0.3em] text-gold uppercase">Jeu de cartes</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Chasseurs de l'Ombre</h1>
        <p className="mt-3 text-muted">Éliminez les monstres, marquez le plus de points. De 3 à 12 joueurs.</p>
      </header>

      {lost && <p className="mb-6 rounded-xl border border-blood/40 bg-blood/10 px-4 py-3 text-sm">{lost}</p>}

      <form onSubmit={join} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-muted">Ton pseudo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint="go"
            placeholder="Ex. Van Helsing"
            className="h-14 rounded-xl border border-line bg-surface px-4 outline-none placeholder:text-faint focus:border-gold"
          />
        </label>

        {initialCode ? (
          <Button type="submit" disabled={!trimmed || busy || !connected}>
            Rejoindre la partie {initialCode}
          </Button>
        ) : (
          <>
            <Button onClick={create} disabled={!trimmed || busy || !connected}>
              Créer une partie
            </Button>

            <div className="my-2 flex items-center gap-3 text-xs text-faint uppercase">
              <span className="h-px flex-1 bg-line" /> ou rejoindre <span className="h-px flex-1 bg-line" />
            </div>

            <div className="flex gap-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                maxLength={ROOM_CODE_LENGTH}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                aria-label="Code de la partie"
                placeholder="CODE"
                className="h-14 w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-center text-xl font-semibold tracking-[0.4em] outline-none placeholder:tracking-[0.2em] placeholder:text-faint focus:border-gold"
              />
              <Button type="submit" variant="secondary" disabled={!trimmed || !validCode || busy || !connected}>
                Rejoindre
              </Button>
            </div>
          </>
        )}
      </form>

      <footer className="mt-auto pt-12 text-center">
        <button
          type="button"
          onClick={createTable}
          disabled={busy || !connected}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink disabled:opacity-40"
        >
          <Tv className="size-4" /> Créer la partie sur un grand écran
        </button>
        {!connected && <p className="mt-3 text-xs text-faint">Connexion au serveur…</p>}
      </footer>
    </main>
  );
}
