import { describe, expect, it } from 'vitest';
import { shouldReload } from '../src/pwa/freshness.ts';

describe('mise à jour après une mise en ligne', () => {
  it('recharge une seule fois quand le serveur a une autre version', () => {
    expect(shouldReload('aaa1111', 'bbb2222', null)).toBe(true);
    expect(shouldReload('aaa1111', 'bbb2222', 'bbb2222')).toBe(false);
    expect(shouldReload('aaa1111', 'ccc3333', 'bbb2222')).toBe(true);
  });

  it('ne fait rien si les versions concordent ou sont inconnues', () => {
    expect(shouldReload('aaa1111', 'aaa1111', null)).toBe(false);
    expect(shouldReload('aaa1111', null, null)).toBe(false);
    expect(shouldReload('aaa1111', 'inconnue', null)).toBe(false);
  });
});
