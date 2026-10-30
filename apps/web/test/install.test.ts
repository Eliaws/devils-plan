import { describe, expect, it } from 'vitest';
import { installMode, isAppleMobile } from '../src/pwa/install.ts';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

describe('installation de l’application', () => {
  it('reconnaît iPhone et iPad (qui se présente comme un Mac tactile), mais pas un vrai Mac', () => {
    expect(isAppleMobile(IPHONE, 5)).toBe(true);
    expect(isAppleMobile(IPAD, 5)).toBe(true);
    expect(isAppleMobile(IPAD, 0)).toBe(false);
    expect(isAppleMobile(ANDROID, 5)).toBe(false);
  });

  it("propose l'invite du navigateur, l'aide iPhone, ou rien si déjà installée", () => {
    expect(installMode({ standalone: false, hasPrompt: true, appleMobile: false })).toBe('prompt');
    expect(installMode({ standalone: false, hasPrompt: false, appleMobile: true })).toBe('ios');
    expect(installMode({ standalone: true, hasPrompt: true, appleMobile: true })).toBe('installed');
    expect(installMode({ standalone: false, hasPrompt: false, appleMobile: false })).toBe('unavailable');
  });
});
