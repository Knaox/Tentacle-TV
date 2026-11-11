import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { SmileyIcon } from "@phosphor-icons/react/dist/csr/Smiley";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { WT_CHAT_MAX_LENGTH, WT_QUICK_REACTIONS } from "@tentacle-tv/shared";
import type { WtChatApi } from "@tentacle-tv/api-client";
import type { PickerTab } from "./picker/ReactionPicker";
import "./chatComposer.css";

/** Le compte à rebours des caractères paraît à ce nombre de la limite. */
const COUNT_FROM = 40;

interface ChatComposerProps {
  chat: WtChatApi;
  pickerTab: PickerTab | null;
  onPickerTab: (tab: PickerTab | null) => void;
  /** Le débit a refusé un envoi : le dire (une ligne brève), au lieu de ne rien faire en silence. */
  onRefused: () => void;
}

/**
 * Watch Together — réagir et écrire : la rangée des réactions (six rapides, le sélecteur
 * d'emojis, les GIF), puis le champ et son bouton.
 *
 * La frappe ne remonte JAMAIS aux raccourcis du lecteur (Espace met en pause, les flèches
 * sautent). Un envoi que le débit refuse (seau à jetons partagé, `watchTogetherChat.ts`) garde
 * le brouillon et le DIT — avant, rien ne se passait.
 */
export function ChatComposer({ chat, pickerTab, onPickerTab, onRefused }: ChatComposerProps) {
  const { t } = useTranslation("watchTogether");
  const [draft, setDraft] = useState("");
  const remaining = WT_CHAT_MAX_LENGTH - draft.length;
  const counting = remaining <= COUNT_FROM;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!chat.sendChat(text)) {
      onRefused();
      return;
    }
    setDraft("");
  };

  const react = (emoji: string) => {
    if (!chat.sendReaction(emoji)) onRefused();
  };

  return (
    <>
      <div className="wtc-reactions" role="group" aria-label={t("pickerTabEmojis")}>
        {WT_QUICK_REACTIONS.map((emoji) => (
          <button key={emoji} type="button" onClick={() => react(emoji)} className="wtc-react" aria-label={emoji}>
            {emoji}
          </button>
        ))}
        <span className="wtc-reactions__sep" aria-hidden />
        <button
          type="button"
          onClick={() => onPickerTab(pickerTab === "emoji" ? null : "emoji")}
          aria-label={t("pickerOpenEmojis")} title={t("pickerOpenEmojis")}
          aria-pressed={pickerTab === "emoji"}
          className="wtc-icon"
        >
          <SmileyIcon size={20} weight={pickerTab === "emoji" ? "fill" : "regular"} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onPickerTab(pickerTab === "gif" ? null : "gif")}
          aria-label={t("pickerOpenGifs")} title={t("pickerOpenGifs")}
          aria-pressed={pickerTab === "gif"}
          className="wtc-pill"
        >
          GIF
        </button>
      </div>

      <form className="wtc-composer" onSubmit={submit}>
        <div className="wtc-field-wrap">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (e.target.value.trim()) chat.notifyTyping();
            }}
            // Ne surtout pas laisser remonter la frappe aux raccourcis du lecteur.
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            maxLength={WT_CHAT_MAX_LENGTH}
            placeholder={t("chatPlaceholder")}
            aria-label={t("chatPlaceholder")}
            autoComplete="off"
            enterKeyHint="send"
            className="wtc-field"
            data-counting={counting}
          />
          {counting && <span className="wtc-count" data-full={remaining <= 0} aria-hidden>{remaining}</span>}
        </div>
        <button type="submit" disabled={!draft.trim()} aria-label={t("chatSend")} title={t("chatSend")} className="wtc-send">
          <PaperPlaneRightIcon size={18} weight="fill" aria-hidden />
        </button>
      </form>
    </>
  );
}
