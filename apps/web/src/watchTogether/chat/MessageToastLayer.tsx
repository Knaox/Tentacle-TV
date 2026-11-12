import { memo } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { isWtAdminChatMessage, type WtChatMessageDto } from "@tentacle-tv/shared";
import { WtAvatar } from "../WatchTogetherRows";
import { chatEntrance } from "./chatMotion";
import { useWatchOverlayState } from "./chatUiStore";
import { duration, easeOut } from "../../theme/motion";
import "./chat.css";
import "./chatThread.css";
import "./chatAdmin.css";

/**
 * Watch Together — aperçus éphémères des messages reçus panneau fermé :
 * mini-bulles empilées au-dessus de la bulle de chat (bas-droite), qui
 * s'estompent après quelques secondes. Toujours visibles, même quand
 * l'overlay lecteur (et donc la bulle) est masqué — on suit la conversation
 * sans rien ouvrir. Couche transparente aux interactions.
 *
 * La peau du chat (`chat.css`) : l'encre des capsules sur la vidéo, les jetons
 * du thème ailleurs.
 */

const ToastRow = memo(function ToastRow({ message }: { message: WtChatMessageDto }) {
  // Mouvement réduit : l'aperçu fond sur place, et la pile ne glisse pas quand l'un d'eux s'en va.
  const reduced = useReducedMotion() === true;
  const { t } = useTranslation("watchTogether");
  // L'administration n'est pas un membre : un insigne à la place de l'avatar, son nom à la place d'un compte.
  const admin = isWtAdminChatMessage(message);
  return (
    <motion.div
      layout={!reduced}
      // Il entre du bord droit (là où vit la bulle) et s'efface plus vite qu'il n'est venu.
      initial={{ opacity: 0, x: chatEntrance(reduced).toastX }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: duration.menuOut, ease: easeOut } }}
      transition={{ duration: duration.menuIn, ease: easeOut }}
      className="flex max-w-[300px] items-start gap-2"
    >
      {admin ? (
        <span className="wtc-admin__badge" aria-hidden><ShieldCheckIcon size={14} weight="bold" /></span>
      ) : (
        <WtAvatar userId={message.userId} name={message.username} size={24} />
      )}
      {/* Opaque : posé sur la vidéo, un flou se paierait à chaque image. */}
      <div className="wtc-capsule wtc-toast">
        <span className="wtc-toast__name">{admin ? t("chatAdmin") : message.username}</span>
        {admin && message.header && <p className="wtc-toast__text font-semibold">{message.header}</p>}
        <p className="wtc-toast__text">{message.text}</p>
      </div>
    </motion.div>
  );
});

export function MessageToastLayer({ toasts }: { toasts: WtChatMessageDto[] }) {
  const { onWatchPage } = useWatchOverlayState();
  return (
    <div className="wtc pointer-events-none fixed bottom-56 right-6 z-50 flex flex-col items-end gap-1.5" data-on-video={onWatchPage} aria-live="polite">
      <AnimatePresence>
        {toasts.map((m) => <ToastRow key={m.id} message={m} />)}
      </AnimatePresence>
    </div>
  );
}
