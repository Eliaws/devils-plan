import { createGame, viewFor } from '@chasseurs/engine';
import { expect, describe as group, it } from 'vitest';
import { describe, makeNames } from '../src/game/describe.ts';

const { state } = createGame({
  players: [
    { id: 'a', name: 'Alice' },
    { id: 'b', name: 'Bob' },
    { id: 'c', name: 'Chloé' },
  ],
  seed: 1,
});
const view = viewFor(state, { kind: 'player', playerId: 'a' });
const names = makeNames(view, 'a');

group('describe', () => {
  it('conjugue à la deuxième personne pour le joueur de cet appareil', () => {
    const kill = (playerId: string) =>
      describe(
        {
          type: 'monsterKilled',
          playerId,
          sideId: `solo:${playerId}`,
          slot: 0,
          monsterId: 'golem',
          points: 18,
          rewardsTo: playerId,
          rewards: [],
        },
        names,
      )?.text;
    expect(kill('a')).toBe('Tu abats Golem ! +18 PV');
    expect(kill('b')).toBe('Bob abat Golem ! +18 PV');
  });

  it('cache la carte Spéciale gagnée par un autre joueur', () => {
    expect(describe({ type: 'specialAwarded', playerId: 'b', sideId: 'solo:b', card: null }, names)?.text).toBe(
      'Bob gagne une carte Spéciale',
    );
    expect(
      describe({ type: 'specialAwarded', playerId: 'a', sideId: 'solo:a', card: 'vague-de-choc' }, names)?.text,
    ).toBe('Tu gagnes Vague de choc');
  });

  it('ignore les événements sans intérêt pour le récit', () => {
    expect(describe({ type: 'bidPlaced', playerId: 'b' }, names)).toBeNull();
    expect(describe({ type: 'planSubmitted', playerId: 'b' }, names)).toBeNull();
  });
});
