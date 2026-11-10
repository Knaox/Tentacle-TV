import { memo, useState, type DragEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
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
      className={`ui-tile relative p-3 outline-none hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-line-focus ${draggable && !selectable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragging ? "opacity-50" : ""}`}
    >
      {selectable && (
        <span aria-hidden className="ui-check absolute right-2 top-2 rounded-full" data-checked={selected}>
          {selected && <CheckIcon size={12} weight="bold" />}
        </span>
      )}
      <p className={`line-clamp-2 text-sm font-semibold text-content-primary ${selectable ? "pr-6" : ""}`}>{ticket.subject}</p>
      {ticket.mediaItemName && (
        <p className="mt-1 truncate text-xs text-accent">{ticket.mediaItemName}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-content-tertiary">
        <span className="rounded-chip bg-fill-soft px-1.5 py-0.5 font-semibold text-content-secondary">
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
