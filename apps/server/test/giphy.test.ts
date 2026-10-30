import { describe, expect, it } from 'vitest';
import { createGiphy, GifUnavailableError, toGifResult } from '../src/giphy.ts';

const rendition = (url: string, width = 200, height = 150) => ({
  url,
  webp: url.replace('.gif', '.webp'),
  width: `${width}`,
  height: `${height}`,
});

const giphyGif = (id: string) => ({
  id,
  title: `GIF ${id}`,
  images: {
    fixed_height: rendition(`https://media1.giphy.com/media/${id}/200.gif`, 267, 200),
    fixed_width_downsampled: rendition(`https://media1.giphy.com/media/${id}/200w_d.gif`),
  },
});

/** Faux fetch : note les adresses demandées et renvoie la réponse fournie. */
function fakeFetch(respond: (url: URL) => { status?: number; body?: unknown }) {
  const calls: URL[] = [];
  const fetchImpl = async (raw: string) => {
    const url = new URL(raw);
    calls.push(url);
    const { status = 200, body = {} } = respond(url);
    return { ok: status < 400, status, json: async () => body };
  };
  return { calls, fetchImpl };
}

describe('GIPHY', () => {
  it('est désactivé sans clé', () => {
    expect(createGiphy(undefined)).toBeNull();
    expect(createGiphy('')).toBeNull();
  });

  it('ne garde que des GIF complets, hébergés chez GIPHY en https', () => {
    expect(toGifResult(giphyGif('abcd1234'))).toEqual({
      id: 'abcd1234',
      title: 'GIF abcd1234',
      url: 'https://media1.giphy.com/media/abcd1234/200.webp',
      previewUrl: 'https://media1.giphy.com/media/abcd1234/200w_d.webp',
      width: 267,
      height: 200,
    });
    const evil = giphyGif('abcd1234');
    evil.images.fixed_height = rendition('https://exemple.com/piege.gif');
    expect(toGifResult(evil)).toBeNull();
    expect(toGifResult({ ...giphyGif('abcd1234'), id: '../x' })).toBeNull();
    expect(toGifResult({ id: 'abcd1234' })).toBeNull();
  });

  it('cherche (ou donne les tendances), avec un cache et une pagination', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({
      body: { data: [giphyGif('aaaa1111'), giphyGif('bbbb2222')], pagination: { total_count: 40 } },
    }));
    const giphy = createGiphy('secret', fetchImpl)!;

    const page = await giphy.search('  Chat ', 0);
    expect(page.gifs.map((g) => g.id)).toEqual(['aaaa1111', 'bbbb2222']);
    expect(page.next).toBe(2);
    expect(calls[0]!.pathname).toBe('/v1/gifs/search');
    expect(calls[0]!.searchParams.get('q')).toBe('chat');
    expect(calls[0]!.searchParams.get('api_key')).toBe('secret');
    expect(calls[0]!.searchParams.get('rating')).toBe('pg-13');

    await giphy.search('chat', 0);
    expect(calls).toHaveLength(1);

    await giphy.search('', 0);
    expect(calls[1]!.pathname).toBe('/v1/gifs/trending');

    // Un GIF vu dans une recherche est retrouvé sans nouvel appel.
    expect((await giphy.get('bbbb2222'))?.title).toBe('GIF bbbb2222');
    expect(calls).toHaveLength(2);
  });

  it('va chercher un GIF inconnu par son identifiant', async () => {
    const { calls, fetchImpl } = fakeFetch((url) =>
      url.pathname.endsWith('/cccc3333') ? { body: { data: giphyGif('cccc3333') } } : { status: 404 },
    );
    const giphy = createGiphy('secret', fetchImpl)!;
    expect((await giphy.get('cccc3333'))?.id).toBe('cccc3333');
    expect(await giphy.get('dddd4444')).toBeNull();
    expect(calls.map((c) => c.pathname)).toEqual(['/v1/gifs/cccc3333', '/v1/gifs/dddd4444']);
  });

  it('signale une panne de GIPHY sans jamais exposer la clé', async () => {
    const giphy = createGiphy('secret', fakeFetch(() => ({ status: 429 })).fetchImpl)!;
    const error = await giphy.search('chat', 0).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GifUnavailableError);
    expect(String((error as Error).message)).not.toContain('secret');
  });
});
