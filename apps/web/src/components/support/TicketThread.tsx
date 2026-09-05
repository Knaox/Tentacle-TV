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
          className={`rounded-xl p-4 ${
            msg.isAdmin
              ? "border border-[rgba(var(--brand-rgb),0.2)] bg-[rgba(var(--brand-rgb),0.1)]"
              : "bg-fill-subtle"
          }`}
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className={`font-medium ${msg.isAdmin ? "text-[var(--brand)]" : "text-content-secondary"}`}>
              {msg.username}
            </span>
            {msg.isAdmin && (
              <span className="rounded bg-[rgba(var(--brand-rgb),0.3)] px-1.5 py-0.5 text-[10px] text-[var(--brand-light)]">
                {t("adminBadge")}
              </span>
            )}
            <span className="text-content-quaternary">{new Date(msg.createdAt).toLocaleString()}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-content-secondary">{msg.body}</p>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
