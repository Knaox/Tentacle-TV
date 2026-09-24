import { getPrisma, hasPrisma } from "./db";

// La cloche ne garde pas l'historique indéfiniment : une notification de plus
// de 30 jours est supprimée de la base, lue ou non. Celle que l'utilisateur
// supprime part tout de suite (routes/notifications.ts) ; cette purge balaie le
// reste. Trente jours couvrent largement la vie d'une demande ou d'un ticket —
// et la cloche n'affiche de toute façon que les vingt dernières.

export const NOTIFICATION_TTL_DAYS = 30;
const TTL_MS = NOTIFICATION_TTL_DAYS * 24 * 60 * 60_000;
const PURGE_INTERVAL_MS = 6 * 60 * 60_000;
const FIRST_PURGE_DELAY_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

/** Supprime les notifications plus vieilles que le délai ; rend leur nombre. */
export async function purgeExpiredNotifications(now = Date.now()): Promise<number> {
  if (!hasPrisma()) return 0;
  const { count } = await getPrisma().notification.deleteMany({
    where: { createdAt: { lt: new Date(now - TTL_MS) } },
  });
  if (count > 0) console.log(`[Notifications] purge : ${count} notification(s) de plus de ${NOTIFICATION_TTL_DAYS} j`);
  return count;
}

export function startNotificationPurge(): void {
  if (timer) return;
  const run = (): void => {
    purgeExpiredNotifications().catch((err) => console.error("[Notifications] purge échouée:", err));
  };
  setTimeout(run, FIRST_PURGE_DELAY_MS);
  timer = setInterval(run, PURGE_INTERVAL_MS);
}

export function stopNotificationPurge(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
