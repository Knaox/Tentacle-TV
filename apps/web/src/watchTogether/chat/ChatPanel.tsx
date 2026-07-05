import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { WT_CHAT_MAX_LENGTH, type WtChatMessageDto } from "@tentacle-tv/shared";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import type { WtChatApi } from "./useWtChat";

/**
 * Watch Together — corps du panneau de chat : liste des messages (auto-scroll
 * collé en bas), barre de réactions rapides, champ de saisie.
 */

const QUICK_EMOJIS = ["😂", "❤️", "🔥", "😮", "👍", "😭"] as const;

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
            {!isSelf && <span className="font-semibold text-purple-300">{message.username}</span>}
            <span className="text-white/30">{formatTime(message.at)}</span>
          </div>
        )}
        <div
          className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-left text-sm text-white/90 ${isSelf ? "rounded-tr-md" : "rounded-tl-md"}`}
          style={{
            background: isSelf
              ? "linear-gradient(135deg, rgba(139,92,246,0.45), rgba(236,72,153,0.35))"
              : "rgba(255,255,255,0.08)",
          }}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
});

export function ChatPanel({ chat }: { chat: WtChatApi }) {
  const { t } = useTranslation("watchTogether");
  const { selfId } = useWatchTogether();
  const [draft, setDraft] = useState("");
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
    if (!text) return;
    chat.sendChat(text);
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
          <p className="px-2 pt-6 text-center text-xs text-white/35">{t("chatEmpty")}</p>
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

      <div className="flex shrink-0 items-center justify-center gap-1 border-t border-white/10 px-2 py-1.5">
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => chat.sendReaction(emoji)}
            className="rounded-lg px-1.5 py-0.5 text-lg transition-transform duration-100 hover:scale-125"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Ne surtout pas laisser remonter la frappe aux hotkeys du player
            // (Espace = pause, flèches = seek…).
            e.stopPropagation();
            if (e.key === "Enter") submit();
          }}
          onKeyUp={(e) => e.stopPropagation()}
          maxLength={WT_CHAT_MAX_LENGTH}
          placeholder={t("chatPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-purple-400/50"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          aria-label={t("chatSend")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-30"
          style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.3 3.9a.5.5 0 0 1 .7-.6l16.6 8.25a.5.5 0 0 1 0 .9L4 20.7a.5.5 0 0 1-.7-.6L6 12Zm0 0h7" />
          </svg>
        </button>
      </div>
    </>
  );
}
