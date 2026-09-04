import {
  TICKET_CATEGORY_LABEL_KEYS,
  TICKET_STATUSES,
  TICKET_STATUS_FILTER_KEYS,
  TICKET_STATUS_LABEL_KEYS,
  type TicketStatus,
} from "@tentacle-tv/api-client";

export { TICKET_STATUSES, TICKET_STATUS_LABEL_KEYS, TICKET_STATUS_FILTER_KEYS, TICKET_CATEGORY_LABEL_KEYS };
export type { TicketStatus };

/**
 * Jetons de thème par statut — la chip d'une carte ou d'une fiche, le point
 * d'une colonne. Une seule table pour tout le tableau (elle remplace les trois
 * copies qu'avaient la liste, la fiche et l'admin).
 */
export const STATUS_STYLE: Record<TicketStatus, { chip: string; dot: string }> = {
  open: { chip: "bg-status-success-bg text-status-success-fg", dot: "bg-status-success-fg" },
  in_progress: { chip: "bg-status-info-bg text-status-info-fg", dot: "bg-status-info-fg" },
  resolved: { chip: "bg-[var(--brand-soft)] text-[var(--brand-light)]", dot: "bg-[var(--brand)]" },
  closed: { chip: "bg-fill-soft text-content-quaternary", dot: "bg-content-quaternary" },
};
