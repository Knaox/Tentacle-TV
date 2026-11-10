import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TicketMessage } from "@tentacle-tv/api-client";

/** Le fil des messages d'un ticket ; se cale en bas quand il s'allonge. */
export function TicketThread({ messages }: { messages: TicketMessage[] }) {
  const { t } = useTranslation("tickets");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`rounded-tile p-4 ${msg.isAdmin ? "bg-surface-3" : "bg-surface-2"}`}
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className={`font-semibold ${msg.isAdmin ? "text-accent" : "text-content-secondary"}`}>
              {msg.username}
            </span>
            {msg.isAdmin && (
              <span className="chip chip-accent h-5 px-1.5 text-[10px]">
                {t("adminBadge")}
              </span>
            )}
            <span className="num text-content-tertiary">{new Date(msg.createdAt).toLocaleString()}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-content-primary">{msg.body}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
