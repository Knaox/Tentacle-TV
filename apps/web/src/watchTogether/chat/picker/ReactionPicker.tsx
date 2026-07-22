import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WtChatApi } from "../useWtChat";
import { EmojiTab } from "./EmojiTab";
import { GifTab } from "./GifTab";

/**
 * Watch Together — sélecteur de réactions (onglets Emojis / GIF), section
 * INLINE du panneau de chat (entre la liste de messages et la barre rapide) :
 * il hérite ainsi du portail fullscreen, du drag et du layout mobile sans
 * aucun calcul d'ancrage. L'envoi (emoji ou GIF) ne le ferme JAMAIS — il se
 * ferme via X, Échap, le re-clic du déclencheur ou la fermeture du panneau.
 *
 * Couleurs volontairement en dur : section du panneau de chat (ChatPanel),
 * qui garde son verre sombre quel que soit le thème.
 */

export type PickerTab = "emoji" | "gif";

export function ReactionPicker({
  tab, onTabChange, onClose, chat,
}: {
  tab: PickerTab | null;
  onTabChange: (tab: PickerTab) => void;
  onClose: () => void;
  chat: WtChatApi;
}) {
  const { t } = useTranslation("watchTogether");

  const tabChip = (target: PickerTab, label: string) => (
    <button
      onClick={() => onTabChange(target)}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
        tab === target ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
      }`}
    >
      {label}
    </button>
  );

  return (
    <AnimatePresence initial={false}>
      {tab && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 240, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="shrink-0 overflow-hidden border-t border-white/10"
          // Ne surtout pas laisser remonter la frappe aux hotkeys du player
          // (même garde que l'input du chat) ; Échap ferme le sélecteur.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onClose();
          }}
          onKeyUp={(e) => e.stopPropagation()}
        >
          <div className="flex h-[240px] flex-col">
            <div className="flex shrink-0 items-center gap-1 px-2 py-1.5">
              {tabChip("emoji", t("pickerTabEmojis"))}
              {tabChip("gif", t("pickerTabGifs"))}
              <button
                onClick={onClose}
                aria-label={t("pickerClose")}
                className="ml-auto rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {tab === "emoji" ? (
              <EmojiTab onPick={(emoji) => chat.sendReaction(emoji)} />
            ) : (
              <GifTab chat={chat} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
