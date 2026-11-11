import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { WtChatApi } from "@tentacle-tv/api-client";
import { duration, easeOut } from "../../../theme/motion";
import { EmojiTab } from "./EmojiTab";
import { GifTab } from "./GifTab";
import "../chatComposer.css";
import "../chatPicker.css";

/**
 * Watch Together — le sélecteur de réactions (onglets Emojis / GIF) : une FEUILLE posée sur le
 * bas du fil, dans le panneau — elle hérite donc du portail plein écran, du glissement et de la
 * disposition mobile sans aucun calcul d'ancrage. L'envoi (emoji ou GIF) ne la ferme JAMAIS —
 * elle se ferme par la croix, Échap, un second clic sur son bouton ou la fermeture du panneau.
 *
 * Elle SORT de la rangée des réactions (origine en bas : opacité et transformée, 180 ms, plus
 * court au retour). Avant le lot rf2, c'était une hauteur animée de 0 à 240 px, qui remettait
 * le fil en page à chaque image de l'ouverture.
 */

export type PickerTab = "emoji" | "gif";

interface ReactionPickerProps {
  tab: PickerTab | null;
  onTabChange: (tab: PickerTab) => void;
  onClose: () => void;
  chat: WtChatApi;
  /** Le débit a refusé une réaction ou un GIF. */
  onRefused: () => void;
}

export function ReactionPicker({ tab, onTabChange, onClose, chat, onRefused }: ReactionPickerProps) {
  const { t } = useTranslation("watchTogether");

  const tabButton = (target: PickerTab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === target} onClick={() => onTabChange(target)} className="wtc-tab">
      {label}
    </button>
  );

  return (
    <AnimatePresence initial={false}>
      {tab && (
        <motion.div
          initial={{ opacity: 0, transform: "translateY(12px) scale(0.98)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)", transition: { duration: duration.menuIn, ease: easeOut } }}
          exit={{ opacity: 0, transform: "translateY(8px) scale(0.98)", transition: { duration: duration.menuOut, ease: easeOut } }}
          className="wtc-picker"
          // Ne surtout pas laisser remonter la frappe aux raccourcis du lecteur
          // (même garde que le champ du chat) ; Échap ferme le sélecteur.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onClose();
          }}
          onKeyUp={(e) => e.stopPropagation()}
        >
          <div className="wtc-picker__head" role="tablist">
            {tabButton("emoji", t("pickerTabEmojis"))}
            {tabButton("gif", t("pickerTabGifs"))}
            <button type="button" onClick={onClose} aria-label={t("pickerClose")} title={t("pickerClose")} className="wtc-icon ml-auto">
              <XIcon size={14} weight="bold" aria-hidden />
            </button>
          </div>

          {tab === "emoji" ? (
            <EmojiTab onPick={(emoji) => { if (!chat.sendReaction(emoji)) onRefused(); }} />
          ) : (
            <GifTab chat={chat} onRefused={onRefused} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
