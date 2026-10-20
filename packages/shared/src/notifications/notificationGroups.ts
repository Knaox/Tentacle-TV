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

/**
 * Le regroupement plus fin du centre mobile (et du web étroit) : Aujourd'hui,
 * Hier, Cette semaine (les sept derniers jours), Plus tôt. Celui du bureau
 * (`groupNotificationsByDay`) reste à deux groupes.
 */
export type NotificationPeriod = "today" | "yesterday" | "week" | "earlier";

const PERIODS: readonly NotificationPeriod[] = ["today", "yesterday", "week", "earlier"];

export function groupNotificationsByPeriod<T extends { createdAt: string }>(
  list: readonly T[],
  now: Date = new Date(),
): Array<{ group: NotificationPeriod; items: T[] }> {
  // Des minuits du CALENDRIER local, jamais « minuit moins 24 h » : un passage à l'heure
  // d'été ou d'hiver fait un jour de 23 ou 25 h, et « Hier » débordait d'une heure.
  const midnightOf = (daysBack: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack).getTime();
  const [today, yesterday, weekStart] = [midnightOf(0), midnightOf(1), midnightOf(6)];
  const buckets: Record<NotificationPeriod, T[]> = { today: [], yesterday: [], week: [], earlier: [] };
  for (const n of list) {
    const at = Date.parse(n.createdAt);
    const period: NotificationPeriod = !Number.isFinite(at) ? "earlier"
      : at >= today ? "today"
      : at >= yesterday ? "yesterday"
      : at >= weekStart ? "week"
      : "earlier";
    buckets[period].push(n);
  }
  return PERIODS.filter((p) => buckets[p].length > 0).map((group) => ({ group, items: buckets[group] }));
}

/** Les filtres du centre : tout, ou seulement les non lues. */
export type NotificationFilter = "all" | "unread";

export function filterNotifications<T extends { read: boolean }>(list: readonly T[], filter: NotificationFilter): T[] {
  return filter === "unread" ? list.filter((n) => !n.read) : [...list];
}
