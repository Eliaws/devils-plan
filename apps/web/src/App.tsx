import { AnimatePresence, motion } from 'motion/react';
import { lazy, type ReactNode, Suspense, useEffect } from 'react';
import { actions, useStore } from './net/store.ts';
import { navigate, paths, useRoute } from './router.ts';
import { Home } from './screens/Home.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { PlayerGame } from './screens/PlayerGame.tsx';
import { Table } from './screens/Table.tsx';
import { Button } from './ui/primitives.tsx';

// Galerie des effets : développement uniquement, absente du site compilé.
const EffectsGallery = import.meta.env.DEV
  ? lazy(() => import('./screens/EffectsGallery.tsx').then((m) => ({ default: m.EffectsGallery })))
  : null;

export function App() {
  const route = useRoute();
  return (
    <>
      {route.name === 'home' && <Home initialCode={route.code} />}
      {route.name === 'play' && <PlayRoute code={route.code} />}
      {route.name === 'table' && <TableRoute code={route.code} />}
      {route.name === 'gallery' && EffectsGallery && (
        <Suspense fallback={<Loading />}>
          <EffectsGallery />
        </Suspense>
      )}
      {route.name === 'notFound' && (
        <Centered>
          <p className="text-muted">Page introuvable.</p>
          <Button variant="secondary" onClick={() => navigate(paths.home())}>
            Accueil
          </Button>
        </Centered>
      )}
      <ErrorToast />
    </>
  );
}

function PlayRoute({ code }: { code: string }) {
  const intent = useStore((s) => s.intent);
  const room = useStore((s) => s.room);
  const game = useStore((s) => s.game);
  const playerId = useStore((s) => s.playerId);
  const lost = useStore((s) => s.lost);

  useEffect(() => {
    const current = useStore.getState().intent;
    if (current?.kind === 'player' && current.code === code) return;
    void actions.resume(code).then((ok) => {
      // Pas de place mémorisée sur cet appareil : on demande un pseudo.
      if (!ok) navigate(`/?code=${code}`, { replace: true });
    });
  }, [code]);

  if (lost) return <Lost message={lost} />;
  if (!intent || !room || room.code !== code || !playerId) return <Loading />;
  if (room.status === 'lobby') return <Lobby room={room} playerId={playerId} />;
  if (!game) return <Loading />;
  return <PlayerGame view={game.view} room={room} playerId={playerId} />;
}

function TableRoute({ code }: { code: string }) {
  const room = useStore((s) => s.room);
  const lost = useStore((s) => s.lost);

  useEffect(() => {
    void actions.watch(code);
  }, [code]);

  if (lost) return <Lost message={lost} />;
  if (!room || room.code !== code) return <Loading />;
  return <Table room={room} />;
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">{children}</main>;
}

function Loading() {
  return (
    <Centered>
      <span role="status" className="size-8 animate-spin rounded-full border-2 border-line border-t-gold">
        <span className="sr-only">Chargement</span>
      </span>
    </Centered>
  );
}

function Lost({ message }: { message: string }) {
  return (
    <Centered>
      <p className="max-w-xs text-muted">{message}</p>
      <Button onClick={() => navigate(paths.home())}>Retour à l'accueil</Button>
    </Centered>
  );
}

function ErrorToast() {
  const error = useStore((s) => s.error);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(actions.dismissError, 4000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <AnimatePresence>
      {error && (
        <motion.button
          type="button"
          onClick={actions.dismissError}
          className="pt-safe fixed inset-x-0 top-0 z-[60] mx-auto w-full max-w-md px-4"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
        >
          <span className="block rounded-xl border border-blood/50 bg-[#2a1214] px-4 py-3 text-left text-sm shadow-xl">
            {error}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
