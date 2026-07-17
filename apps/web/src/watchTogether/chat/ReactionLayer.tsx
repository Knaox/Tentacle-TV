import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WtFloatingReaction } from "./chatState";

/**
 * Watch Together — couche des réactions éphémères (emoji ou GIF) : chaque
 * réaction s'élève depuis le bas-droite de l'écran (côté bulle de chat) en
 * s'estompant, avec une dérive horizontale pseudo-aléatoire seedée par sa clé
 * (stable au re-render). Couche entièrement transparente aux interactions.
 */

/** Hash déterministe [0..1) — dérive/offset propres à chaque réaction. */
function seeded(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(hash) % 1000) / 1000;
}

const FloatingEmoji = memo(function FloatingEmoji({ reaction }: { reaction: WtFloatingReaction }) {
  const seed = seeded(reaction.key);
  const drift = (seed - 0.5) * 120; // dérive horizontale −60..+60 px
  const startOffset = seed * 90;    // décale le point de départ des rafales
  // Un GIF est un contenu à regarder : il monte un peu plus lentement (TTL
  // aligné côté useWtChat : WT_GIF_TTL_MS > WT_REACTION_TTL_MS).
  const duration = reaction.gif ? 3.9 : 2.4;

  return (
    <motion.div
      initial={{ opacity: 0, y: 0, x: -startOffset, scale: 0.6 }}
      animate={{ opacity: [0, 1, 1, 0], y: -260, x: -startOffset + drift, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, ease: "easeOut", opacity: { times: [0, 0.1, 0.75, 1], duration } }}
      className="absolute bottom-24 right-16 flex flex-col items-center"
    >
      {reaction.gif ? (
        <img
          src={reaction.gif.url}
          alt=""
          draggable={false}
          className="h-24 w-auto max-w-[160px] rounded-xl border border-white/15 object-cover shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
          style={reaction.gif.w && reaction.gif.h ? { aspectRatio: `${reaction.gif.w} / ${reaction.gif.h}` } : undefined}
        />
      ) : (
        <span className="text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{reaction.emoji}</span>
      )}
      <span className="mt-0.5 rounded-full bg-black/50 px-1.5 text-[10px] font-medium text-white/75">
        {reaction.username}
      </span>
    </motion.div>
  );
});

export function ReactionLayer({ reactions }: { reactions: WtFloatingReaction[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {reactions.map((r) => <FloatingEmoji key={r.key} reaction={r} />)}
      </AnimatePresence>
    </div>
  );
}
