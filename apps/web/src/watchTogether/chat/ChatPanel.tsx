import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneRight";
import { SmileyIcon } from "@phosphor-icons/react/dist/csr/Smiley";
import { CHAT_ACCENT, CHAT_FIELD, CHAT_ICON_BUTTON, CHAT_ICON_BUTTON_ON } from "./chatSkin";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WT_CHAT_MAX_LENGTH, WT_QUICK_REACTIONS, typingLabelKey, type WtChatMessageDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import type { WtChatApi } from "@tentacle-tv/api-client";
import { ReactionPicker, type PickerTab } from "./picker/ReactionPicker";

/**
 * Watch Together — corps du panneau de chat : liste des messages (auto-scroll
 * collé en bas), sélecteur emojis/GIFs, barre de réactions rapides, champ de
 * saisie.
 *
 * Couleurs volontairement en dur : intérieur de l'overlay de chat en lecture
 * (ChatOverlay), qui garde son verre sombre quel que soit le thème.
 */


function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const MessageRow = memo(function MessageRow({
  message, isSelf, showAuthor,
}: {
  message: WtChatMessageDto;
  isSelf: boolean;
  showAuthor: boolean;
}) {
  return (
    <div className={`flex gap-2 ${isSelf ? "flex-row-reverse" : ""} ${showAuthor ? "mt-2.5" : "mt-0.5"}`}>
      <div className="w-7 shrink-0">
        {showAuthor && !isSelf && (
          <WtAvatar userId={message.userId} name={message.username} size={28} />
        )}
      </div>
      <div className={`min-w-0 max-w-[80%] ${isSelf ? "text-right" : ""}`}>
        {showAuthor && (
          <div className={`mb-0.5 flex items-baseline gap-2 text-[11px] ${isSelf ? "flex-row-reverse" : ""}`}>
            {!isSelf && <span className="font-semibold" style={{ color: CHAT_ACCENT }}>{message.username}</span>}
            {/* L'heure se LIT : 55 % de blanc, plus 30. */}
            <span className="tabular-nums text-white/55">{formatTime(message.at)}</span>
          </div>
        )}
        <div
          // Ses messages : le fond doux de la teinte franche ; ceux des autres : une encre claire.
          // Plus de dégradé de marque — et le texte est blanc plein, il se lit sur les deux.
          className={`inline-block whitespace-pre-wrap break-words rounded-tile px-3 py-1.5 text-left text-sm leading-snug text-white ${isSelf ? "rounded-tr-chip" : "rounded-tl-chip"}`}
          style={{ background: isSelf ? "rgba(229, 140, 240, 0.24)" : "rgba(255, 255, 255, 0.1)" }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
});

/** « X est en train d'écrire… » — les autres membres, jamais soi. */
function TypingLine({ typing }: { typing: WtChatApi["state"]["typing"] }) {
  const { t } = useTranslation("watchTogether");
  const label = typingLabelKey(typing);
  return (
    <p aria-live="polite" className="h-4 shrink-0 truncate px-4 text-[11px] italic text-white/60">
      {label ? t(label.key, label.params) : ""}
    </p>
  );
}

export function ChatPanel({ chat }: { chat: WtChatApi }) {
  const { t } = useTranslation("watchTogether");
  const { selfId } = useWatchTogether();
  const [draft, setDraft] = useState("");
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const { messages } = chat.state;

  // Auto-scroll : collé en bas sauf si l'utilisateur remonte lire le fil.
  useEffect(() => {
    const list = listRef.current;
    if (list && stickToBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickToBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  };

  const submit = () => {
    const text = draft.trim();
    // Refusé (débit) : le brouillon reste, rien ne se perd en silence.
    if (!text || !chat.sendChat(text)) return;
    setDraft("");
    stickToBottomRef.current = true;
  };

  return (
    <>
      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2"
      >
        {messages.length === 0 ? (
          <p className="px-2 pt-6 text-center text-xs text-white/60">{t("chatEmpty")}</p>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            return (
              <MessageRow
                key={m.id}
                message={m}
                isSelf={m.userId === selfId}
                showAuthor={!prev || prev.userId !== m.userId || m.at - prev.at > 120_000}
              />
            );
          })
        )}
      </div>

      <TypingLine typing={chat.state.typing} />

      <ReactionPicker
        tab={pickerTab}
        onTabChange={setPickerTab}
        onClose={() => setPickerTab(null)}
        chat={chat}
      />

      <div className="flex shrink-0 items-center justify-center gap-1 border-t border-white/10 px-2 py-1.5">
        {WT_QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => chat.sendReaction(emoji)}
            className="flex h-8 w-8 items-center justify-center rounded-pill text-lg transition-[background-color,transform] duration-hover hover:bg-white/10 active:scale-90"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
        <span className="mx-0.5 h-4 w-px shrink-0 bg-white/10" />
        <button
          onClick={() => setPickerTab((cur) => (cur === "emoji" ? null : "emoji"))}
          aria-label={t("pickerOpenEmojis")}
          title={t("pickerOpenEmojis")}
          type="button"
          aria-pressed={pickerTab === "emoji"}
          className={`${CHAT_ICON_BUTTON} ${pickerTab === "emoji" ? CHAT_ICON_BUTTON_ON : ""}`}
        >
          <SmileyIcon size={20} weight={pickerTab === "emoji" ? "fill" : "regular"} aria-hidden />
        </button>
        <button
          onClick={() => setPickerTab((cur) => (cur === "gif" ? null : "gif"))}
          aria-label={t("pickerOpenGifs")}
          title={t("pickerOpenGifs")}
          type="button"
          aria-pressed={pickerTab === "gif"}
          className={`flex h-8 shrink-0 items-center rounded-pill px-2.5 text-[11px] font-bold tracking-wide outline-none transition-[background-color,color,transform] duration-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 ${
            pickerTab === "gif" ? "bg-white/[0.16] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          GIF
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (e.target.value.trim()) chat.notifyTyping();
          }}
          onKeyDown={(e) => {
            // Ne surtout pas laisser remonter la frappe aux hotkeys du player
            // (Espace = pause, flèches = seek…).
            e.stopPropagation();
            if (e.key === "Enter") submit();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          maxLength={WT_CHAT_MAX_LENGTH}
          placeholder={t("chatPlaceholder")}
          aria-label={t("chatPlaceholder")}
          className={`${CHAT_FIELD} h-10`}
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          aria-label={t("chatSend")}
          type="button"
          title={t("chatSend")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-[#F4F2EE] text-[#131315] outline-none transition-[background-color,transform,opacity] duration-hover hover:bg-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70 disabled:opacity-35"
        >
          <PaperPlaneRightIcon size={18} weight="fill" aria-hidden />
        </button>
      </div>
    </>
  );
}
