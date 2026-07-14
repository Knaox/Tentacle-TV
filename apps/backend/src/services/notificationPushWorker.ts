import { getPrisma, hasPrisma } from "./db";
import { sendToUser } from "./pushService";

// Livraison push GÉNÉRIQUE des notifications in-app. Le core possède déjà la
// table Notification ; ce worker se contente de « délivrer » en push celles dont
// le type est mappé à une préférence utilisateur activée. AUCUN couplage plugin :
// on ne connaît ici que des chaînes de type déjà déclarées dans le schéma core
// (le plugin Seer, lui, continue d'écrire ses lignes `request_status` sans
// aucune modification — on ne fait que les livrer).
//
// Correspondance type de notification → clé de préférence (extensible :
// ex. ticket_reply → une future préférence « tickets »).
const PUSHABLE: Record<string, "seerAvailable"> = {
  request_status: "seerAvailable",
};

const POLL_INTERVAL = 15_000;
// Fenêtre de fraîcheur : au (re)démarrage, on ne rejoue PAS tout l'historique de
// notifs non poussées (pushedAt=null) — seulement celles créées récemment.
const FRESH_WINDOW_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;
let bootTime = 0;
let running = false;

async function tick(): Promise<void> {
  if (running || !hasPrisma()) return;
  running = true;
  try {
    const prisma = getPrisma();
    const notifs = await prisma.notification.findMany({
      where: {
        pushedAt: null,
        type: { in: Object.keys(PUSHABLE) },
        createdAt: { gte: new Date(bootTime - FRESH_WINDOW_MS) },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (notifs.length === 0) return;

    const userIds = [...new Set(notifs.map((n) => n.jellyfinUserId))];
    const prefs = await prisma.notificationPreference.findMany({
      where: { jellyfinUserId: { in: userIds } },
    });
    const prefByUser = new Map(prefs.map((p) => [p.jellyfinUserId, p]));

    for (const n of notifs) {
      const prefKey = PUSHABLE[n.type];
      const enabled = !!prefKey && prefByUser.get(n.jellyfinUserId)?.[prefKey] === true;
      if (enabled) {
        await sendToUser(n.jellyfinUserId, {
          title: n.title,
          body: n.body ?? "",
          data: { type: n.type, refId: n.refId ?? undefined },
        });
      }
    }

    // Marque TOUTES les notifs balayées comme poussées (opted-out incluses) pour
    // ne pas les re-scanner indéfiniment.
    await prisma.notification.updateMany({
      where: { id: { in: notifs.map((n) => n.id) } },
      data: { pushedAt: new Date() },
    });
  } catch (err) {
    console.error("[NotifPush] Tick échoué:", err);
  } finally {
    running = false;
  }
}

export function startNotificationPushWorker(): void {
  if (timer) return;
  bootTime = Date.now();
  console.log("[NotifPush] Démarrage worker de livraison push (15s)");
  timer = setInterval(() => void tick(), POLL_INTERVAL);
}

export function stopNotificationPushWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
