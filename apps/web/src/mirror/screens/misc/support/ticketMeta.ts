import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL_KEYS,
  TICKET_STATUSES,
  TICKET_STATUS_FILTER_KEYS,
  TICKET_STATUS_LABEL_KEYS,
  type TicketCategory,
  type TicketStatus,
} from "@tentacle-tv/api-client";
import type { BadgeVariant } from "./Badge";

export { TICKET_CATEGORIES, TICKET_CATEGORY_LABEL_KEYS, TICKET_STATUSES, TICKET_STATUS_LABEL_KEYS };
export type { TicketCategory, TicketStatus };

/** `STATUS_BADGE` de l'app (`support/ticketTypes.ts`) : la couleur de chaque statut. */
export const STATUS_VARIANT: Record<TicketStatus, BadgeVariant> = {
  open: "success",
  in_progress: "accent",
  resolved: "gold",
  closed: "muted",
};

/** `FILTERS` de l'app : « Tous » puis un filtre par statut. */
export const FILTERS: { key: TicketStatus | ""; tKey: string }[] = [
  { key: "", tKey: "tickets:all" },
  ...TICKET_STATUSES.map((s) => ({ key: s, tKey: TICKET_STATUS_FILTER_KEYS[s] })),
];

/** La clé du libellé d'une catégorie ; une catégorie inconnue s'affiche telle quelle. */
export function categoryLabelKey(category: string): string | null {
  return (TICKET_CATEGORIES as readonly string[]).includes(category)
    ? TICKET_CATEGORY_LABEL_KEYS[category as TicketCategory]
    : null;
}
