import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { TicketMessage } from "@tentacle-tv/api-client";
import { Badge } from "./Badge";

/**
 * `MessageBubble` de l'app : rayon 12, padding 14, 88 % au plus ; l'admin à
 * gauche sur `brand.soft` (filet violet 25 %), l'utilisateur à droite sur s2.
 * Nom 12 semi-gras, badge Admin, date 10 ; corps 14/21 à 90 %.
 */
export const MessageBubble = memo(function MessageBubble({ msg }: { msg: TicketMessage }) {
  const { t } = useTranslation("tickets");
  return (
    <div
      className={`rounded-xl border ${msg.isAdmin ? "self-start" : "self-end bg-surface-2 border-line-subtle"}`}
      style={{
        padding: 14,
        maxWidth: "88%",
        ...(msg.isAdmin ? { background: "var(--brand-soft)", borderColor: "rgba(var(--brand-rgb), 0.25)" } : null),
      }}
      aria-label={`${msg.username}: ${msg.body}`}
    >
      <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
        <span
          className="font-semibold"
          style={{ fontSize: 12, color: msg.isAdmin ? "var(--brand-light)" : "var(--text-secondary)" }}
        >
          {msg.username}
        </span>
        {msg.isAdmin && <Badge label={t("adminBadge")} variant="accent" />}
        <span className="ml-auto text-content-quaternary" style={{ fontSize: 10 }}>
          {new Date(msg.createdAt).toLocaleString()}
        </span>
      </div>
      <p
        className="whitespace-pre-wrap break-words"
        style={{ fontSize: 14, lineHeight: "21px", color: "color-mix(in srgb, var(--text-primary) 90%, transparent)" }}
      >
        {msg.body}
      </p>
    </div>
  );
});
