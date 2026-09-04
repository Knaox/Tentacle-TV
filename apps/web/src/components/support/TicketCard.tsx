import { memo, useState, type DragEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { formatAgo } from "../notifications/NotifRow";
import { TICKET_CATEGORY_LABEL_KEYS } from "./ticketMeta";
import type { TicketBoardScope } from "./useTicketBoard";

interface TicketCardProps {
  ticket: SupportTicket;
  scope: TicketBoardScope;
  /** Glissable d'une colonne à l'autre (admin, pointeur). */
  draggable: boolean;
  onOpen: (id: string) => void;
  /** Mode sélection (admin) : le clic coche au lieu d'ouvrir. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

/**
 * Une carte du tableau. Le glisser HTML5 n'est qu'un raccourci pointeur : le
 * chemin universel (tactile, clavier, lecteur d'écran) est le sélecteur de
 * statut de la fiche. Pas de verre ni d'ombre animée : une opacité pendant le
 * glisser, un fond au survol, rien d'autre (règles GPU de CLAUDE.md).
 */
export const TicketCard = memo(function TicketCard({
  ticket, scope, draggable, onOpen, selectable, selected, onToggleSelect,
}: TicketCardProps) {
  const { t } = useTranslation("tickets");
  const [dragging, setDragging] = useState(false);
  const open = () => (selectable ? onToggleSelect?.(ticket.id) : onOpen(ticket.id));
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
  const onDragStart = (e: DragEvent<HTMLElement>) => {
    e.dataTransfer.effectAllowed = "move";
    // Firefox exige une donnée pour démarrer un glisser.
    e.dataTransfer.setData("text/plain", ticket.id);
    setDragging(true);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      aria-pressed={selectable ? !!selected : undefined}
      draggable={(draggable && !selectable) || undefined}
      onDragStart={draggable && !selectable ? onDragStart : undefined}
      onDragEnd={draggable ? () => setDragging(false) : undefined}
      className={`relative rounded-lg border bg-fill-subtle p-3 outline-none transition-colors hover:bg-fill-soft focus-visible:ring-2 focus-visible:ring-[var(--brand)]/50 ${
        selected ? "border-[var(--brand)]/45" : "border-line-subtle"
      } ${draggable && !selectable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragging ? "opacity-50" : ""}`}
    >
      {selectable && (
        <span
          aria-hidden
          className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border ${
            selected ? "border-[var(--brand)]/45 bg-[var(--brand-soft)] text-[var(--brand-light)]" : "border-line-strong"
          }`}
        >
          {selected && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      )}
      <p className={`line-clamp-2 text-sm font-medium text-content-primary ${selectable ? "pr-6" : ""}`}>{ticket.subject}</p>
      {ticket.mediaItemName && (
        <p className="mt-1 truncate text-xs text-[var(--brand)]">{ticket.mediaItemName}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-content-quaternary">
        <span className="rounded bg-fill-soft px-1.5 py-0.5 text-content-tertiary">
          {t(TICKET_CATEGORY_LABEL_KEYS[ticket.category] ?? "")}
        </span>
        {ticket._count && <span>{t("messagesCount", { count: ticket._count.messages })}</span>}
        <span className="ml-auto">{formatAgo(new Date(ticket.updatedAt), t)}</span>
      </div>
      {scope === "all" && (
        <p className="mt-1 text-[11px] text-content-tertiary">{t("by", { username: ticket.username })}</p>
      )}
    </article>
  );
});
