/**
 * Les notifications rangées par jour, dans l'ordre servi (la plus récente
 * d'abord) : « Aujourd'hui », puis « Plus tôt ». Un groupe vide n'existe pas.
 * Le jour est celui de l'APPAREIL (minuit local), jamais celui du serveur.
 */
export type NotificationDayGroup = "today" | "earlier";

export function groupNotificationsByDay<T extends { createdAt: string }>(
  list: readonly T[],
  now: Date = new Date(),
): Array<{ group: NotificationDayGroup; items: T[] }> {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const today: T[] = [];
  const earlier: T[] = [];
  for (const n of list) {
    const at = Date.parse(n.createdAt);
    (Number.isFinite(at) && at >= midnight ? today : earlier).push(n);
  }
  const out: Array<{ group: NotificationDayGroup; items: T[] }> = [];
  if (today.length > 0) out.push({ group: "today", items: today });
  if (earlier.length > 0) out.push({ group: "earlier", items: earlier });
  return out;
}
