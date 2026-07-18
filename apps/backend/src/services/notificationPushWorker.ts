import { getPrisma, hasPrisma } from "./db";
import { sendToUser } from "./pushService";
import { exactPushKey, isAnnounced, recordAnnounced } from "./announcedRegistry";
import { planSeerAvailabilityPush } from "./seerPushPlanner";

// Livraison push GÉNÉRIQUE des notifications in-app. Le core possède déjà la
// table Notification ; ce worker se contente de « délivrer » en push celles dont
// le type est mappé à une préférence utilisateur activée. AUCUN couplage plugin :
// on ne connaît ici que des chaînes de type déjà déclarées dans le schéma core
// (le plugin Seer, lui, continue d'écrire ses lignes `request_status` sans
// aucune modification — on ne fait que les livrer).
//
// Garde anti-doublon (registre announced_contents) : avant chaque push, on
// vérifie que ce contenu n'a pas déjà été annoncé à cet utilisateur — par ce
// worker (le syncGlobal du plugin recrée une notif à CHAQUE transition de
// statut) OU par le notifier bibliothèque (croisement Seer ↔ biblio). Seul le
// PUSH est étouffé : la notification in-app (cloche) reste intacte.
//
// Garde de VÉRITÉ (seerAvailabilityGuard + seerPushPlanner) : une annonce de
// dispo (« … est sorti sur Tentacle TV ») dont le contenu n'est PAS réellement
// dans Jellyfin (statut Jellyseerr périmé) est DIFFÉRÉE — ni push, ni registre,
// ni pushedAt. La fenêtre de fraîcheur comparant à un bootTime FIXE, la ligne
// différée est re-scannée à chaque tick et poussée à l'arrivée RÉELLE du
// contenu. Multi-saisons : chaque saison est poussée QUAND elle arrive
// (« Saison N est sortie ») et la ligne reste différée jusqu'à avoir honoré
// toutes les saisons annoncées. Assumé : restart serveur (ou suppression de la
// notif dans la cloche) = abandon du différé ; la ligne (fausse) écrite par le
// plugin reste visible dans la cloche.
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

    // Claims des utilisateurs du lot — IDENTIFICATION du contenu (titre → tmdb)
    // pour les clés du registre, pas suppression : on n'exclut pas les expirés.
    const claims = await prisma.contentClaim.findMany({
      where: { jellyfinUserId: { in: userIds } },
      select: { jellyfinUserId: true, tmdbId: true, title: true, mediaType: true },
    });
    const claimsByUser = new Map<string, typeof claims>();
    for (const c of claims) {
      const list = claimsByUser.get(c.jellyfinUserId) ?? [];
      list.push(c);
      claimsByUser.set(c.jellyfinUserId, list);
    }

    const deferredIds = new Set<string>();
    for (const n of notifs) {
      const prefKey = PUSHABLE[n.type];
      const enabled = !!prefKey && prefByUser.get(n.jellyfinUserId)?.[prefKey] === true;
      if (!enabled) continue;
      // Annonce de dispo Seer → plan du planificateur (vérité Jellyfin,
      // découpage par saison, clés tmdb via claim synthétique). Sinon (autres
      // statuts de demande), chemin générique à clé exacte.
      const userClaims = claimsByUser.get(n.jellyfinUserId) ?? [];
      const plan = await planSeerAvailabilityPush(n, userClaims);
      if (plan?.action === "defer") {
        deferredIds.add(n.id);
        continue;
      }
      const keys = plan ? plan.keys : [exactPushKey(n)];
      if (plan?.action === "skip" || (!plan && (await isAnnounced(n.jellyfinUserId, keys)))) {
        // Enrichissement : mêmes contenus, alias éventuellement nouveaux.
        await recordAnnounced(n.jellyfinUserId, keys);
        console.log(`[NotifPush] skip doublon[${n.jellyfinUserId.slice(0, 8)}] « ${n.title} »`);
        continue;
      }
      const res = await sendToUser(n.jellyfinUserId, {
        title: n.title,
        body: plan ? plan.body : (n.body ?? ""),
        data: { type: n.type, refId: n.refId ?? undefined },
      });
      console.log(
        `[NotifPush] push[${n.jellyfinUserId.slice(0, 8)}] « ${n.title} » (sent:${res.sent}, invalid:${res.invalid})`,
      );
      await recordAnnounced(n.jellyfinUserId, keys);
      // Push partiel (saisons manquantes) : la ligne reste différée pour
      // livrer le reste à l'arrivée.
      if (plan && !plan.complete) deferredIds.add(n.id);
    }

    // Marque les notifs balayées comme poussées (opted-out incluses) pour ne
    // pas les re-scanner indéfiniment — SAUF les différées (guard de vérité),
    // qui doivent rester éligibles jusqu'à l'arrivée réelle du contenu.
    const toMark = notifs.filter((n) => !deferredIds.has(n.id)).map((n) => n.id);
    if (toMark.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: toMark } },
        data: { pushedAt: new Date() },
      });
    }
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
