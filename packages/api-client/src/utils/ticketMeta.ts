/**
 * Énumérations des tickets de support — la source UNIQUE des clients (web et
 * mobile) : statuts, catégories, et les clés i18n qui les nomment. Les valeurs
 * sont des chaînes traversantes (base, API, filtres d'URL) : jamais renommées.
 *
 * Les clés sont préfixées par leur espace de noms : i18next les résout même
 * depuis un `t` lié à un autre espace.
 */

export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_CATEGORIES = ["general", "bug", "feature", "account"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

/** Le statut au singulier (« Ouvert ») — chip d'une carte, titre de colonne. */
export const TICKET_STATUS_LABEL_KEYS: Record<TicketStatus, string> = {
  open: "tickets:statusOpen",
  in_progress: "tickets:statusInProgress",
  resolved: "tickets:statusResolved",
  closed: "tickets:statusClosed",
};

/** Le statut au pluriel (« Ouverts ») — filtres et onglets. */
export const TICKET_STATUS_FILTER_KEYS: Record<TicketStatus, string> = {
  open: "tickets:open",
  in_progress: "tickets:inProgress",
  resolved: "tickets:resolved",
  closed: "tickets:closed",
};

export const TICKET_CATEGORY_LABEL_KEYS: Record<TicketCategory, string> = {
  general: "tickets:categoryGeneral",
  bug: "tickets:categoryBug",
  feature: "tickets:categoryFeature",
  account: "tickets:categoryAccount",
};
