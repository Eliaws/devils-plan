// Rejoue une résolution événement par événement (vue Table) : le plateau affiché évolue
// au fil des coups, avec une légende, avant de basculer sur l'état final.

import { type GameEvent, type GameView, MONSTERS, type MonsterView, type PlayerId } from '@umbra/engine';
import type { GameUpdate } from '@umbra/protocol';
import { useEffect, useRef, useState } from 'react';
import type { SlotFlash } from '../components/Board.tsx';
import { describe, type Line, makeNames } from './describe.ts';

export interface Frame {
  view: GameView;
  caption: Line | null;
  flashes: Partial<Record<number, SlotFlash>>;
  /** Joueur en train d'agir (mis en avant sur l'écran principal). */
  actorId: PlayerId | null;
  /** Cartes jouées par ce joueur, montrées dans la légende. */
  cards: string[];
}

/** Au-delà de ce nombre d'images en attente, l'animation accélère. */
const CATCH_UP_THRESHOLD = 8;

const idle = (view: GameView): Frame => ({ view, caption: null, flashes: {}, actorId: null, cards: [] });

function applyToBoard(board: (MonsterView | null)[], event: GameEvent): (MonsterView | null)[] {
  const next = [...board];
  const patch = (slot: number, change: Partial<MonsterView>) => {
    const monster = next[slot];
    if (monster) next[slot] = { ...monster, ...change };
  };
  switch (event.type) {
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
    case 'protectionEnded':
      for (const [slot, monster] of next.entries()) {
        if (monster?.id === event.monsterId) next[slot] = { ...monster, protectedBy: null };
      }
      break;
    case 'monsterNetted':
      patch(event.slot, { netOwnerId: event.playerId });
      break;
  }
  return next;
}

/** Petit texte flottant au-dessus d'un monstre. */
function flashLabel(event: GameEvent): string | undefined {
  switch (event.type) {
    case 'monsterKilled':
      return `+${event.points}`;
    case 'attackLost':
      return 'Raté';
    case 'damageBlocked':
      return 'Protégé';
    default:
      return undefined;
  }
}

function buildFrames(previous: GameView, update: GameUpdate, me: PlayerId | null): Frame[] {
  const names = makeNames(update.view, me);
  const frames: Frame[] = [];
  let board = previous.board;
  let actorId: PlayerId | null = null;
  let cards: string[] = [];

  update.events.forEach((event, index) => {
    board = applyToBoard(board, event);
    if (event.type === 'actionRevealed') {
      actorId = event.playerId;
      cards = [event.plan.equipment?.card, event.plan.special?.card].filter((c): c is NonNullable<typeof c> => !!c);
    }
    const caption = describe(event, names);
    if (caption && event.type !== 'roundStarted' && event.type !== 'bidsRevealed') {
      const label = flashLabel(event);
      const flashes =
        caption.slot !== undefined
          ? { [caption.slot]: { key: index, tone: caption.tone, ...(label ? { label } : {}) } }
          : {};
      frames.push({
        view: { ...previous, board },
        caption,
        flashes,
        actorId,
        cards: event.type === 'actionRevealed' ? cards : [],
      });
    }
    // Le monstre abattu reste visible pendant son image de mort, puis laisse sa place.
    if (event.type === 'monsterKilled') {
      board = [...board];
      board[event.slot] = null;
    }
  });
  return frames;
}

/**
 * Les résolutions s'enchaînent dans une file : une nouvelle mise ou une nouvelle manche
 * n'interrompt jamais l'animation en cours, elle met seulement à jour l'état final affiché ensuite.
 */
export function usePlayback(update: GameUpdate | null, me: PlayerId | null, stepMs = 1500): Frame | null {
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
    setFrame(next ?? idle(update.view));
  }, [update, me]);

  useEffect(() => {
    // Si l'animation prend du retard (joueurs qui enchaînent vite), elle accélère.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (playing.current) {
        const next = queue.current.shift();
        if (next) {
          setFrame(next);
        } else {
          playing.current = false;
          if (latest.current) setFrame(idle(latest.current));
        }
      }
      timer = setTimeout(tick, queue.current.length > CATCH_UP_THRESHOLD ? stepMs / 3 : stepMs);
    };
    timer = setTimeout(tick, stepMs);
    return () => clearTimeout(timer);
  }, [stepMs]);

  return frame;
}
