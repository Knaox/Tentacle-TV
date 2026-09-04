import type { AppNotification } from "../hooks/useNotifications";
import { TICKET_STATUS_LABEL_KEYS } from "./ticketMeta";

/**
 * Le texte d'une notification, à partir de sa ligne BRUTE (le serveur stocke
 * le sujet, le statut, « auteur puis extrait » — jamais une phrase traduite).
 * Une seule implémentation pour la cloche web et la cloche mobile.
 */

/** `t` d'i18next, réduit à ce qu'on en fait : compatible avec `TFunction`. */
export type NotifTranslate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Corps des notifs adressées aux admins : première ligne = auteur, le reste =
 * extrait (miroir de apps/backend/src/services/ticketNotifTypes.ts).
 */
export function parseTicketNotifBody(body: string | null | undefined): {
  username: string;
  excerpt: string;
} {
  if (!body) return { username: "", excerpt: "" };
  const at = body.indexOf("\n");
  if (at < 0) return { username: "", excerpt: body };
  return { username: body.slice(0, at), excerpt: body.slice(at + 1) };
}

// Les toutes premières lignes stockaient une phrase française déjà composée :
// on la relit pour la retraduire, plutôt que d'afficher du français à un
// compte en anglais.
const LEGACY_REPLY = /^Réponse sur\s+"(.+)"$/;
const LEGACY_STATUS = /^Ticket\s+"(.+?)"\s+—\s+(.+)$/;
const FR_STATUS_TO_KEY: Record<string, string> = {
  Ouvert: "open",
  "En cours": "in_progress",
  Résolu: "resolved",
  Fermé: "closed",
};

function statusLabel(raw: string, t: NotifTranslate): string {
  const key = (TICKET_STATUS_LABEL_KEYS as Record<string, string | undefined>)[raw];
  return key ? t(key) : raw;
}

export function formatNotifTitle(
  n: Pick<AppNotification, "type" | "title" | "body">,
  t: NotifTranslate,
): string {
  switch (n.type) {
    case "ticket_reply": {
      const legacy = n.title.match(LEGACY_REPLY);
      return t("notifications:ticketReplyTitle", { subject: legacy ? legacy[1] : n.title });
    }
    case "ticket_status": {
      if (n.body && n.body in TICKET_STATUS_LABEL_KEYS) {
        return t("notifications:ticketStatusTitle", { subject: n.title, status: statusLabel(n.body, t) });
      }
      const legacy = n.title.match(LEGACY_STATUS);
      const key = legacy ? FR_STATUS_TO_KEY[legacy[2]] : undefined;
      if (legacy && key) {
        return t("notifications:ticketStatusTitle", { subject: legacy[1], status: statusLabel(key, t) });
      }
      return n.title;
    }
    case "ticket_new": {
      const { username } = parseTicketNotifBody(n.body);
      return t("notifications:ticketNewTitle", { username, subject: n.title });
    }
    case "ticket_user_reply": {
      const { username } = parseTicketNotifBody(n.body);
      return t("notifications:ticketUserReplyTitle", { username, subject: n.title });
    }
    case "ticket_user_closed": {
      const { username } = parseTicketNotifBody(n.body);
      return t("notifications:ticketUserClosedTitle", { username, subject: n.title });
    }
    default:
      return n.title;
  }
}

/**
 * Ce que la ligne montre sous le titre : rien pour un statut (le corps est la
 * valeur brute, déjà dans le titre), l'extrait seul pour les types admin (le
 * nom est déjà dans le titre), le corps tel quel sinon.
 */
export function notifBodyText(n: Pick<AppNotification, "type" | "body">): string | null {
  if (!n.body) return null;
  switch (n.type) {
    case "ticket_status":
      return null;
    case "ticket_new":
    case "ticket_user_reply":
    case "ticket_user_closed":
      return parseTicketNotifBody(n.body).excerpt || null;
    default:
      return n.body;
  }
}
