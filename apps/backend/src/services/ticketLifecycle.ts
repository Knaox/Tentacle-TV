import { getPrisma, hasPrisma } from "./db";
import { notifyTicketOwner } from "./ticketNotifier";
import { TICKET_NOTIF_TYPES } from "./ticketNotifTypes";

/**
 * Cycle de vie automatique des tickets.
 *
 * Deux règles, un seul délai :
 *  - un ticket RÉSOLU sans nouvelle depuis sept jours passe en FERMÉ (l'auteur
 *    en est notifié comme pour tout changement de statut) ;
 *  - un ticket FERMÉ depuis sept jours disparaît des listes et du tableau —
 *    la ligne reste en base (une notification ancienne mène encore à sa
 *    fiche), elle n'est plus proposée.
 * La fermeture automatique rafraîchit `updatedAt` : un ticket résolu vit donc
 * sept jours en « Résolu », puis sept en « Fermé », avant de s'effacer.
 */

const DAY_MS = 24 * 3600_000;
export const AUTO_CLOSE_AFTER_MS = 7 * DAY_MS;
export const HIDE_CLOSED_AFTER_MS = 7 * DAY_MS;

const TICK_MS = 3600_000;
const BOOT_DELAY_MS = 30_000;

/** Acteur de la fermeture automatique : personne à exclure des destinataires. */
const SYSTEM_ACTOR = { userId: "", username: "system", isAdmin: true };

/** Clause Prisma des tickets encore visibles dans les listes. */
export function visibleTicketsWhere(now = Date.now()): {
  OR: Array<{ status: { not: string } } | { updatedAt: { gte: Date } }>;
} {
  return {
    OR: [{ status: { not: "closed" } }, { updatedAt: { gte: new Date(now - HIDE_CLOSED_AFTER_MS) } }],
  };
}

/** Ferme les tickets résolus depuis trop longtemps ; renvoie leur nombre. */
export async function autoCloseResolvedTickets(now = Date.now()): Promise<number> {
  const prisma = getPrisma();
  const stale = await prisma.supportTicket.findMany({
    where: { status: "resolved", updatedAt: { lt: new Date(now - AUTO_CLOSE_AFTER_MS) } },
    select: { id: true, subject: true, jellyfinUserId: true },
  });
  for (const ticket of stale) {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "closed", updatedAt: new Date(now) },
    });
    await notifyTicketOwner(ticket, "ticket_status", "closed", SYSTEM_ACTOR);
  }
  if (stale.length > 0) console.log(`[Tickets] ${stale.length} ticket(s) résolu(s) fermé(s) automatiquement`);
  return stale.length;
}

/**
 * Suppression (admin) d'un ou plusieurs tickets : les messages partent en
 * cascade, et les notifications qui y menaient aussi — une cloche qui pointe
 * vers une fiche introuvable ne sert personne. Renvoie le nombre supprimé.
 */
export async function deleteTickets(ids: string[]): Promise<number> {
  const prisma = getPrisma();
  const { count } = await prisma.supportTicket.deleteMany({ where: { id: { in: ids } } });
  await prisma.notification.deleteMany({
    where: { refId: { in: ids }, type: { in: [...TICKET_NOTIF_TYPES] } },
  });
  return count;
}

let timer: ReturnType<typeof setInterval> | null = null;
let bootTimer: ReturnType<typeof setTimeout> | null = null;

async function tick(): Promise<void> {
  if (!hasPrisma()) return;
  try {
    await autoCloseResolvedTickets();
  } catch (err) {
    console.error("[Tickets] Fermeture automatique en échec :", err);
  }
}

export function startTicketLifecycleWorker(): void {
  if (timer) return;
  bootTimer = setTimeout(() => void tick(), BOOT_DELAY_MS);
  timer = setInterval(() => void tick(), TICK_MS);
}

export function stopTicketLifecycleWorker(): void {
  if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
  if (timer) { clearInterval(timer); timer = null; }
}
