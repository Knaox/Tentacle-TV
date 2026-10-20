import { isFamilyNotificationType, type NotificationState, type NotificationTarget } from "@tentacle-tv/shared";
import { notificationStateMeta, type NotificationTone } from "./notificationState";

/**
 * Le visuel d'une notification, en MOTS : la famille de son icône et son ton.
 * La même règle que la cloche du bureau (`notifVisuals.tsx`) — l'icône de son
 * ÉTAT s'il en a un, sinon celle de sa famille ; chaque client traduit le
 * glyphe dans sa bibliothèque d'icônes (Lucide, Feather), jamais d'emoji.
 */
export type NotificationGlyph =
  | NotificationState
  | "ticket"
  | "family"
  | "watchlist"
  | "request"
  | "title"
  | "generic";

export function notificationVisual(n: {
  type: string;
  state?: unknown;
  target?: NotificationTarget | null;
}): { glyph: NotificationGlyph; tone: NotificationTone | null } {
  const meta = notificationStateMeta(n.state);
  if (meta) return { glyph: meta.state, tone: meta.tone };
  if (n.type.startsWith("ticket_")) return { glyph: "ticket", tone: null };
  if (isFamilyNotificationType(n.type)) return { glyph: "family", tone: null };
  if (n.type === "watchlist_share") return { glyph: "watchlist", tone: null };
  if (n.type === "request_status") return { glyph: "request", tone: null };
  if (n.type === "library_added" || n.target?.kind === "item" || n.target?.kind === "title") return { glyph: "title", tone: null };
  return { glyph: "generic", tone: null };
}

/**
 * La date d'une notification, relative tant qu'elle est récente : à
 * l'instant, en minutes, en heures, en jours (moins d'une semaine), puis la
 * date. Chaque client la dit avec ses clés i18n.
 */
export type NotificationAgo =
  | { unit: "now" }
  | { unit: "minutes" | "hours" | "days"; count: number }
  | { unit: "date"; date: Date };

export function notificationAgo(createdAt: string, now: number = Date.now()): NotificationAgo {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return { unit: "now" };
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 1) return { unit: "now" };
  if (mins < 60) return { unit: "minutes", count: mins };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { unit: "hours", count: hours };
  const days = Math.floor(hours / 24);
  if (days < 7) return { unit: "days", count: days };
  return { unit: "date", date: new Date(at) };
}
