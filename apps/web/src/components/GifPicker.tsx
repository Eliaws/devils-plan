import type { GifResult } from '@umbra/protocol';
import { LoaderCircle, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { actions } from '../net/store.ts';
import { Sheet } from '../ui/primitives.tsx';

/** Recherches toutes prêtes, pour réagir vite pendant la résolution. */
const SUGGESTIONS = ['bravo', 'mdr', 'non', 'peur', 'victoire', 'rage', 'trahison', 'rip'];
const DEBOUNCE_MS = 400;

interface Results {
  query: string;
  gifs: GifResult[];
  next: number | null;
}

/** Panneau de recherche de GIF (via le serveur, qui seul connaît la clé GIPHY). */
export function GifPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  /** Numéro de la dernière recherche : les réponses périmées sont ignorées. */
  const latest = useRef(0);

  const load = async (q: string, offset: number) => {
    const ticket = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const page = await actions.searchGifs(q, offset);
      if (ticket !== latest.current) return;
      setResults((previous) => ({
        query: q,
        gifs: offset > 0 && previous?.query === q ? [...previous.gifs, ...page.gifs] : page.gifs,
        next: page.next,
      }));
    } catch (e) {
      if (ticket === latest.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  };

  // Recherche temporisée pendant la saisie ; tendances quand le champ est vide.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (results?.query === q) return;
    const timer = setTimeout(() => void load(q, 0), q ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [open, query]);

  const send = async (gif: GifResult) => {
    if (sending) return;
    setSending(gif.id);
    navigator.vibrate?.(12);
    const ok = await actions.sendGif(gif.id);
    setSending(null);
    if (ok) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Envoyer un GIF">
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <label className="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 focus-within:border-gold/60">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un GIF"
            aria-label="Chercher un GIF"
            maxLength={50}
            enterKeyHint="search"
            className="h-11 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Effacer" className="text-muted">
              <X className="size-4" />
            </button>
          )}
        </label>
        <div className="-mx-5 mt-2 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
          {SUGGESTIONS.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => setQuery(word)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-sm text-muted transition hover:text-ink aria-pressed:border-gold/60 aria-pressed:text-gold"
              aria-pressed={query.trim() === word}
            >
              {word}
            </button>
          ))}
        </div>
      </div>

      {!query.trim() && results?.query === '' && <p className="mb-2 text-xs text-muted">Tendances</p>}

      {error ? (
        <p className="py-10 text-center text-sm text-muted">{error}</p>
      ) : results && results.gifs.length === 0 && !loading ? (
        <p className="py-10 text-center text-sm text-muted">Aucun GIF pour « {results.query} ».</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {results?.gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              onClick={() => void send(gif)}
              disabled={sending !== null}
              aria-label={gif.title || 'GIF'}
              className="relative aspect-square overflow-hidden rounded-lg bg-raised transition active:scale-95 disabled:opacity-60"
            >
              <img src={gif.previewUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
              {sending === gif.id && (
                <span className="absolute inset-0 grid place-items-center bg-black/50">
                  <LoaderCircle className="size-6 animate-spin text-gold" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-14 items-center justify-center">
        {loading ? (
          <LoaderCircle className="size-5 animate-spin text-muted" aria-label="Chargement" />
        ) : (
          results?.next != null &&
          !error && (
            <button
              type="button"
              onClick={() => void load(results.query, results.next ?? 0)}
              className="rounded-full border border-line px-4 py-1.5 text-sm text-muted hover:text-ink"
            >
              Plus de GIF
            </button>
          )
        )}
      </div>

      {/* Mention exigée par GIPHY. */}
      <p className="pb-4 text-center text-[11px] font-semibold tracking-wide text-muted">Powered by GIPHY</p>
    </Sheet>
  );
}
