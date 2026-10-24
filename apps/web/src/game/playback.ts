// Rejoue une résolution événement par événement (vue Table) : le plateau affiché évolue
// au fil des coups, avec une légende, avant de basculer sur l'état final.

import { type GameEvent, type GameView, MONSTERS, type MonsterView, type PlayerId } from '@chasseurs/engine';
import type { GameUpdate } from '@chasseurs/protocol';
import { useEffect, useRef, useState } from 'react';
import type { SlotFlash } from '../components/Board.tsx';
import { describe, type Line, makeNames } from './describe.ts';

interface Frame {
  view: GameView;
  caption: Line | null;
  flashes: Partial<Record<number, SlotFlash>>;
}

function applyToBoard(board: (MonsterView | null)[], event: GameEvent): (MonsterView | null)[] {
  const next = [...board];
  const patch = (slot: number, change: Partial<MonsterView>) => {
    const monster = next[slot];
    if (monster) next[slot] = { ...monster, ...change };
  };
  switch (event.type) {
    case 'monsterKilled':
      next[event.slot] = null;
      break;
    case 'monsterRevealed':
      next[event.slot] = {
        id: event.monsterId,
        maxHp: MONSTERS[event.monsterId].hp,
        frozen: false,
        poisoned: false,
        netOwnerId: null,
        protectedBy: null,
      };
      break;
    case 'monsterFrozen':
      patch(event.slot, { frozen: true });
      break;
    case 'monsterPoisoned':
      patch(event.slot, { poisoned: true });
      break;
    case 'monsterProtected':
      patch(event.slot, { protectedBy: event.playerId });
      break;
    case 'monsterNetted':
      patch(event.slot, { netOwnerId: event.playerId });
      break;
  }
  return next;
}

function buildFrames(previous: GameView, update: GameUpdate, me: PlayerId | null): Frame[] {
  const names = makeNames(update.view, me);
  const frames: Frame[] = [];
  let board = previous.board;
  update.events.forEach((event, index) => {
    board = applyToBoard(board, event);
    const caption = describe(event, names);
    if (!caption || event.type === 'roundStarted' || event.type === 'bidsRevealed') return;
    const flashes = caption.slot !== undefined ? { [caption.slot]: { key: index, tone: caption.tone } } : {};
    frames.push({ view: { ...previous, board }, caption, flashes });
  });
  return frames;
}

/**
 * Les résolutions s'enchaînent dans une file : une nouvelle mise ou une nouvelle manche
 * n'interrompt jamais l'animation en cours, elle met seulement à jour l'état final affiché ensuite.
 */
export function usePlayback(update: GameUpdate | null, me: PlayerId | null, stepMs = 1300): Frame | null {
  const [frame, setFrame] = useState<Frame | null>(null);
  const latest = useRef<GameView | null>(null);
  const queue = useRef<Frame[]>([]);
  const playing = useRef(false);

  useEffect(() => {
    if (!update) return;
    const before = latest.current;
    latest.current = update.view;
    if (before && update.events.some((e) => e.type === 'resolutionStarted')) {
      queue.current.push(...buildFrames(before, update, me));
    }
    if (playing.current) return;
    const next = queue.current.shift();
    playing.current = next !== undefined;
    setFrame(next ?? { view: update.view, caption: null, flashes: {} });
  }, [update, me]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!playing.current) return;
      const next = queue.current.shift();
      if (next) {
        setFrame(next);
        return;
      }
      playing.current = false;
      if (latest.current) setFrame({ view: latest.current, caption: null, flashes: {} });
    }, stepMs);
    return () => clearInterval(timer);
  }, [stepMs]);

  return frame;
}
