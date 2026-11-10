import { WarningIcon as AlertTriangle } from "@phosphor-icons/react/dist/csr/Warning";
import { ProhibitIcon as Ban } from "@phosphor-icons/react/dist/csr/Prohibit";
import { BellIcon as Bell } from "@phosphor-icons/react/dist/csr/Bell";
import { CheckCircleIcon as CheckCircle2 } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { ClockIcon as Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { FilmStripIcon as Film } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { HourglassIcon as Hourglass } from "@phosphor-icons/react/dist/csr/Hourglass";
import { LifebuoyIcon as LifeBuoy } from "@phosphor-icons/react/dist/csr/Lifebuoy";
import { QueueIcon as ListVideo } from "@phosphor-icons/react/dist/csr/Queue";
import { TruckIcon as Truck } from "@phosphor-icons/react/dist/csr/Truck";
import { UsersIcon as Users } from "@phosphor-icons/react/dist/csr/Users";
import { XCircleIcon as XCircle } from "@phosphor-icons/react/dist/csr/XCircle";
import type { Icon as IconType } from "@phosphor-icons/react";
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

const STATE_ICON: Record<string, IconType> = {
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
export function notifIcon(n: AppNotification): { Icon: IconType; tone: NotificationTone | null } {
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
