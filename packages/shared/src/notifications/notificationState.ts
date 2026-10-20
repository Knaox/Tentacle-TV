import { parseNotificationState, type NotificationState } from "./notificationTarget";

/**
 * La pastille d'une notification : un MOT et un TON (jamais la couleur seule).
 * Une seule table pour la cloche du web, du bureau, du miroir et du mobile ;
 * chaque client traduit le ton dans ses jetons (`--status-*`).
 */
export type NotificationTone = "success" | "info" | "neutral" | "warning" | "danger";

export const NOTIFICATION_STATE_META: Record<NotificationState, { labelKey: string; tone: NotificationTone }> = {
  available: { labelKey: "notifications:stateAvailable", tone: "success" },
  progress: { labelKey: "notifications:stateProgress", tone: "info" },
  pending: { labelKey: "notifications:statePending", tone: "neutral" },
  blocked: { labelKey: "notifications:stateBlocked", tone: "warning" },
  declined: { labelKey: "notifications:stateDeclined", tone: "danger" },
  failed: { labelKey: "notifications:stateFailed", tone: "danger" },
};

/** La pastille d'une notification, ou null (aucun état, ou un état inconnu de ce client). */
export function notificationStateMeta(state: unknown): { state: NotificationState; labelKey: string; tone: NotificationTone } | null {
  const known = parseNotificationState(state);
  return known ? { state: known, ...NOTIFICATION_STATE_META[known] } : null;
}
