import { describe, expect, it } from 'vitest';
import { parseRoute } from '../src/router.ts';

describe('parseRoute', () => {
  it('reconnaît les trois écrans et normalise le code', () => {
    expect(parseRoute('/')).toEqual({ name: 'home' });
    expect(parseRoute('/', '?code=abcd')).toEqual({ name: 'home', code: 'ABCD' });
    expect(parseRoute('/p/abcd')).toEqual({ name: 'play', code: 'ABCD' });
    expect(parseRoute('/t/WXYZ')).toEqual({ name: 'table', code: 'WXYZ' });
    expect(parseRoute('/inconnu')).toEqual({ name: 'notFound' });
  });
});
