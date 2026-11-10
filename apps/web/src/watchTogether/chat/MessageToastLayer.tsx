import { CHAT_ACCENT, CHAT_CAPSULE } from "./chatSkin";
import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WtChatMessageDto } from "@tentacle-tv/shared";
import { WtAvatar } from "../WatchTogetherRows";

/**
 * Watch Together — aperçus éphémères des messages reçus panneau fermé :
 * mini-bulles empilées au-dessus de la bulle de chat (bas-droite), qui
 * s'estompent après quelques secondes. Toujours visibles, même quand
 * l'overlay lecteur (et donc la bulle) est masqué — on suit la conversation
 * sans rien ouvrir. Couche transparente aux interactions.
 *
 * Couleurs volontairement en dur : même famille overlay de chat, flotte sur
 * la vidéo comme sur n'importe quelle page — indépendant du thème.
 */

const ToastRow = memo(function ToastRow({ message }: { message: WtChatMessageDto }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.4 } }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex max-w-[300px] items-start gap-2"
    >
      <WtAvatar userId={message.userId} name={message.username} size={24} />
      <div
        // L'encre des capsules, opaque : posé sur la vidéo, un flou se paierait à chaque image.
        className="min-w-0 rounded-tile rounded-tl-chip px-3 py-1.5"
        style={CHAT_CAPSULE}
      >
        <span className="text-[11px] font-semibold" style={{ color: CHAT_ACCENT }}>{message.username}</span>
        <p className="line-clamp-2 break-words text-sm text-white">{message.text}</p>
      </div>
    </motion.div>
  );
});

export function MessageToastLayer({ toasts }: { toasts: WtChatMessageDto[] }) {
  return (
    <div className="pointer-events-none fixed bottom-56 right-6 z-50 flex flex-col items-end gap-1.5">
      <AnimatePresence>
        {toasts.map((m) => <ToastRow key={m.id} message={m} />)}
      </AnimatePresence>
    </div>
  );
}
