/**
 * Types de notification émis par les tickets de support — miroir strict de ce
 * que les clients résolvent (packages/api-client/src/utils/notificationRoute.ts
 * et notificationText.ts). Ce sont des chaînes STOCKÉES en base : ne jamais
 * les renommer.
 *
 * Invariant des lignes : `title` = sujet du ticket, `refId` = id du ticket.
 * `body` = extrait de la réponse (`ticket_reply`), statut brut
 * (`ticket_status`), ou « auteur puis extrait » sur deux lignes pour les
 * types adressés aux admins — pas de JSON : un client ancien afficherait des
 * accolades, là il affiche un nom puis un extrait, lisibles.
 */

export const TICKET_NOTIF_TYPES = [
  "ticket_reply",
  "ticket_status",
  "ticket_new",
  "ticket_user_reply",
] as const;

export type TicketNotifType = (typeof TICKET_NOTIF_TYPES)[number];
/** Adressés à l'AUTEUR du ticket. */
export type TicketOwnerNotifType = "ticket_reply" | "ticket_status";
/** Adressés aux ADMINS. */
export type TicketAdminNotifType = "ticket_new" | "ticket_user_reply";

export function isTicketNotifType(type: string): type is TicketNotifType {
  return (TICKET_NOTIF_TYPES as readonly string[]).includes(type);
}

/** Corps des types admin : première ligne = auteur, le reste = extrait. */
export function composeTicketNotifBody(username: string, excerpt: string): string {
  return `${username.replace(/\r?\n/g, " ")}\n${excerpt}`;
}

export function parseTicketNotifBody(body: string | null | undefined): {
  username: string;
  excerpt: string;
} {
  if (!body) return { username: "", excerpt: "" };
  const at = body.indexOf("\n");
  if (at < 0) return { username: "", excerpt: body };
  return { username: body.slice(0, at), excerpt: body.slice(at + 1) };
}
