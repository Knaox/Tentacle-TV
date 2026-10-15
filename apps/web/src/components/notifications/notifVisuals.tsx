import { AlertTriangle, Ban, Bell, CheckCircle2, Clock, Film, Hourglass, LifeBuoy, ListVideo, Truck, Users, XCircle, type LucideIcon } from "lucide-react";
import { isFamilyNotificationType } from "@tentacle-tv/shared";
import { notificationStateMeta, type AppNotification, type NotificationTone } from "@tentacle-tv/api-client";

/** Le ton d'une pastille dans les jetons du thème (clair et sombre). */
export const TONE_STYLE: Record<NotificationTone, { fg: string; bg: string }> = {
  success: { fg: "var(--status-success-fg)", bg: "var(--status-success-bg)" },
  info: { fg: "var(--status-info-fg)", bg: "var(--status-info-bg)" },
  neutral: { fg: "var(--text-tertiary)", bg: "var(--fill-soft)" },
  warning: { fg: "var(--status-warning-fg)", bg: "var(--status-warning-bg)" },
  danger: { fg: "var(--status-error-fg)", bg: "var(--status-error-bg)" },
};

const STATE_ICON: Record<string, LucideIcon> = {
  available: CheckCircle2,
  progress: Truck,
  pending: Hourglass,
  blocked: AlertTriangle,
  declined: Ban,
  failed: XCircle,
};

/**
 * L'icône d'une notification : celle de son ÉTAT s'il en a un, sinon celle de
 * sa famille (support, Famille, liste partagée, titre). Jamais d'emoji.
 */
export function notifIcon(n: AppNotification): { Icon: LucideIcon; tone: NotificationTone | null } {
  const meta = notificationStateMeta(n.state);
  if (meta) return { Icon: STATE_ICON[meta.state] ?? Bell, tone: meta.tone };
  if (n.type.startsWith("ticket_")) return { Icon: LifeBuoy, tone: null };
  if (isFamilyNotificationType(n.type)) return { Icon: Users, tone: null };
  if (n.type === "watchlist_share") return { Icon: ListVideo, tone: null };
  if (n.type === "request_status") return { Icon: Clock, tone: null };
  if (n.target?.kind === "item" || n.target?.kind === "title") return { Icon: Film, tone: null };
  return { Icon: Bell, tone: null };
}

/** La pastille d'état : un mot sur un aplat du ton — lisible sans la couleur. */
export function NotifStateBadge({ state, label }: { state: AppNotification["state"]; label: (key: string) => string }) {
  const meta = notificationStateMeta(state);
  if (!meta) return null;
  const tone = TONE_STYLE[meta.tone];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4"
      style={{ color: tone.fg, background: tone.bg }}
    >
      {label(meta.labelKey)}
    </span>
  );
}
