// Recherche de GIF via GIPHY. La clé d'API reste sur le serveur (variable d'environnement
// GIPHY_API_KEY) : les téléphones passent toujours par ici et ne la voient jamais.
// Les réponses sont gardées en cache, car une clé gratuite est limitée en nombre d'appels.

import type { GifResult } from '@umbra/protocol';

const API = 'https://api.giphy.com/v1/gifs';
const PAGE_SIZE = 24;
const RATING = 'pg-13';
const SEARCH_TTL_MS = 10 * 60 * 1000;
const MAX_SEARCHES = 300;
const MAX_GIFS = 3000;

export interface GifPage {
  gifs: GifResult[];
  next: number | null;
}

export interface GifProvider {
  /** Tendances si `query` est vide. */
  search(query: string, offset: number): Promise<GifPage>;
  /** GIF déjà vu (cache) ou demandé à GIPHY ; null s'il n'existe pas. */
  get(id: string): Promise<GifResult | null>;
}

export class GifUnavailableError extends Error {}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;

/** Rendition GIPHY (sous-ensemble utile). */
interface Rendition {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id?: string;
  title?: string;
  images?: Record<string, Rendition | undefined>;
}

/** N'accepte que des images servies par GIPHY, en https. */
function safeUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && (url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com'))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function toGifResult(gif: GiphyGif): GifResult | null {
  const images = gif.images ?? {};
  const main = images.fixed_height ?? images.downsized_medium ?? images.original;
  const preview = images.fixed_width_downsampled ?? images.fixed_width_small ?? images.fixed_width ?? main;
  const url = safeUrl(main?.webp ?? main?.url);
  const previewUrl = safeUrl(preview?.webp ?? preview?.url);
  const width = Number(main?.width);
  const height = Number(main?.height);
  if (!gif.id || !/^[A-Za-z0-9]{4,40}$/.test(gif.id) || !url || !previewUrl || !(width > 0) || !(height > 0)) {
    return null;
  }
  return { id: gif.id, title: (gif.title ?? '').slice(0, 80), url, previewUrl, width, height };
}

/** Map bornée : on oublie les entrées les plus anciennes au-delà de `max`. */
function remember<K, V>(map: Map<K, V>, key: K, value: V, max: number) {
  map.delete(key);
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value as K);
}

export function createGiphy(apiKey: string | undefined, fetchImpl: Fetch = fetch): GifProvider | null {
  if (!apiKey) return null;
  const gifs = new Map<string, GifResult>();
  const searches = new Map<string, { at: number; page: GifPage }>();

  const call = async (path: string, params: Record<string, string>): Promise<unknown> => {
    const url = `${API}${path}?${new URLSearchParams({ api_key: apiKey, ...params })}`;
    let response: Awaited<ReturnType<Fetch>>;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new GifUnavailableError('GIPHY ne répond pas.');
    }
    if (response.status === 404) return null;
    // Jamais l'adresse dans le message : elle contient la clé.
    if (!response.ok) throw new GifUnavailableError(`GIPHY a répondu ${response.status}.`);
    return response.json();
  };

  const keep = (raw: GiphyGif[]): GifResult[] => {
    const results: GifResult[] = [];
    for (const item of raw) {
      const gif = toGifResult(item);
      if (!gif) continue;
      remember(gifs, gif.id, gif, MAX_GIFS);
      results.push(gif);
    }
    return results;
  };

  return {
    async search(query, offset) {
      const q = query.trim().toLowerCase();
      const key = `${q}|${offset}`;
      const cached = searches.get(key);
      if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.page;

      const params = { limit: String(PAGE_SIZE), offset: String(offset), rating: RATING };
      const body = (await call(q ? '/search' : '/trending', q ? { ...params, q, lang: 'fr' } : params)) as {
        data?: GiphyGif[];
        pagination?: { total_count?: number; count?: number; offset?: number };
      } | null;
      const data = Array.isArray(body?.data) ? body.data : [];
      const end = offset + data.length;
      const total = body?.pagination?.total_count ?? 0;
      const page: GifPage = { gifs: keep(data), next: data.length > 0 && end < Math.min(total, 500) ? end : null };
      remember(searches, key, { at: Date.now(), page }, MAX_SEARCHES);
      return page;
    },

    async get(id) {
      const cached = gifs.get(id);
      if (cached) return cached;
      const body = (await call(`/${encodeURIComponent(id)}`, {})) as { data?: GiphyGif } | null;
      return body?.data ? (keep([body.data])[0] ?? null) : null;
    },
  };
}
