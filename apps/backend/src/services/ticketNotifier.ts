import { getPrisma } from "./db";
import { sendToUser as wsSendToUser } from "./wsManager";
import { listUsersRights } from "./jellyfinAdminPolicy";
import type { JellyfinUser } from "../middleware/auth";
import {
  composeTicketNotifBody,
  type TicketAdminNotifType,
  type TicketOwnerNotifType,
} from "./ticketNotifTypes";

/**
 * Notifications de la vie d'un ticket : lignes en base (la cloche) et
 * `notifications:update` sur le socket de chaque destinataire (la cloche se
 * rafraîchit tout de suite, au lieu d'attendre le polling). Le push, lui, est
 * livré par notificationPushWorker à partir des mêmes lignes.
 *
 * Deux règles : on ne se notifie JAMAIS soi-même, et rien ici ne fait
 * échouer la route appelante — le ticket ou la réponse est déjà écrit quand
 * on arrive, une notification manquée se logge et c'est tout.
 *
 * `wsSendToUser` plutôt que `broadcastToUser` : ce dernier debounce 5 s par
 * (utilisateur, canal) — un ticket suivi d'une réponse dans la foulée
 * perdrait son second rafraîchissement.
 */

export interface TicketRef {
  id: string;
  subject: string;
  jellyfinUserId: string;
}

const EXCERPT_MAX = 200;
const ADMIN_CACHE_TTL_MS = 5 * 60_000;

/** L'extrait d'un message tel qu'il est stocké dans le corps de la notif. */
export function excerptOf(text: string): string {
  return text.trim().slice(0, EXCERPT_MAX);
}

interface NotificationRow {
  jellyfinUserId: string;
  type: string;
  title: string;
  body: string;
  refId: string;
}

async function createAndNotify(rows: NotificationRow[]): Promise<void> {
  if (rows.length === 0) return;
  await getPrisma().notification.createMany({ data: rows });
  for (const userId of new Set(rows.map((r) => r.jellyfinUserId))) {
    wsSendToUser(userId, { type: "notifications:update", action: "refresh" });
  }
}

function logFailure(what: string, err: unknown): void {
  console.warn(`[Tickets] ${what} :`, err instanceof Error ? err.message : err);
}

/** L'auteur du ticket (réponse d'un admin, changement de statut). */
export async function notifyTicketOwner(
  ticket: TicketRef,
  type: TicketOwnerNotifType,
  body: string,
  actor: JellyfinUser,
): Promise<void> {
  if (ticket.jellyfinUserId === actor.userId) return;
  try {
    await createAndNotify([
      { jellyfinUserId: ticket.jellyfinUserId, type, title: ticket.subject, body, refId: ticket.id },
    ]);
  } catch (err) {
    logFailure(`auteur non notifié (${type})`, err);
  }
}

// Les ids des admins Jellyfin, via la clé API serveur. Cache mémoire : un
// appel Jellyfin au plus toutes les 5 min, et la valeur périmée sert de repli
// quand Jellyfin ne répond pas — même esprit que le cache de jetons de
// middleware/auth.ts.
let adminCache: { ids: string[]; at: number } | null = null;

async function listAdminRecipients(excludeUserId: string): Promise<string[]> {
  const now = Date.now();
  if (!adminCache || now - adminCache.at > ADMIN_CACHE_TTL_MS) {
    try {
      const users = await listUsersRights();
      adminCache = { ids: users.filter((u) => u.isAdministrator).map((u) => u.id), at: now };
    } catch (err) {
      if (!adminCache) throw err;
      logFailure("Jellyfin injoignable, liste d'admins périmée réutilisée", err);
    }
  }
  return adminCache.ids.filter((id) => id !== excludeUserId);
}

/** Banc d'essai : oublie la liste d'admins mise en cache. */
export function resetAdminRecipientsCache(): void {
  adminCache = null;
}

/** Tous les admins sauf l'acteur (nouveau ticket, réponse d'un utilisateur). */
export async function notifyAdmins(
  ticket: TicketRef,
  type: TicketAdminNotifType,
  actor: JellyfinUser,
  excerpt: string,
): Promise<void> {
  try {
    const recipients = await listAdminRecipients(actor.userId);
    const body = composeTicketNotifBody(actor.username, excerpt);
    await createAndNotify(
      recipients.map((jellyfinUserId) => ({
        jellyfinUserId,
        type,
        title: ticket.subject,
        body,
        refId: ticket.id,
      })),
    );
  } catch (err) {
    logFailure(`admins non notifiés (${type})`, err);
  }
}
