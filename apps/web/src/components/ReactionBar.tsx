import { EMOJI_REACTIONS, type EmojiReaction } from '@umbra/protocol';
import { motion } from 'motion/react';
import { useState } from 'react';
import { actions, useStore } from '../net/store.ts';
import { GifPicker } from './GifPicker.tsx';

/** Rangée d'émojis à envoyer sur l'écran principal, et GIF si le serveur les permet. */
export function ReactionBar() {
  const [last, setLast] = useState<{ emoji: EmojiReaction; key: number } | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const gifs = useStore((s) => s.room?.gifs ?? false);

  const send = (emoji: EmojiReaction) => {
    navigator.vibrate?.(12);
    setLast({ emoji, key: Date.now() });
    void actions.react({ kind: 'emoji', emoji });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Réagis sur l'écran principal</p>
        {gifs && (
          <button
            type="button"
            onClick={() => setGifOpen(true)}
            className="rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-bold tracking-wider text-gold transition active:scale-95"
          >
            GIF
          </button>
        )}
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {EMOJI_REACTIONS.map((emoji) => (
          <motion.button
            key={emoji}
            type="button"
            onClick={() => send(emoji)}
            whileTap={{ scale: 1.35 }}
            aria-label={`Réagir ${emoji}`}
            className="relative grid aspect-square place-items-center rounded-xl bg-raised text-2xl"
          >
            {emoji}
            {last?.emoji === emoji && (
              <motion.span
                key={last.key}
                className="pointer-events-none absolute text-2xl"
                initial={{ y: 0, opacity: 1 }}
                animate={{ y: -48, opacity: 0 }}
                transition={{ duration: 0.8 }}
                aria-hidden
              >
                {emoji}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>
      {gifs && <GifPicker open={gifOpen} onClose={() => setGifOpen(false)} />}
    </div>
  );
}
