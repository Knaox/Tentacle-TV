import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { Shimmer } from "@tentacle-tv/ui";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { TicketCard } from "./TicketCard";
import { STATUS_STYLE, TICKET_STATUS_LABEL_KEYS, type TicketStatus } from "./ticketMeta";
import type { TicketBoardScope } from "./useTicketBoard";

interface TicketColumnProps {
  status: TicketStatus;
  tickets: SupportTicket[];
  scope: TicketBoardScope;
  /** Cible de dépôt (admin) : même motif que HomeRowsEditor. */
  canDrop: boolean;
  isLoading: boolean;
  /** Seule colonne à l'écran (onglets mobiles) : pas de hauteur bornée. */
  single?: boolean;
  onOpen: (id: string) => void;
  onDrop: (id: string, status: TicketStatus) => void;
}

export function TicketColumn({ status, tickets, scope, canDrop, isLoading, single, onOpen, onDrop }: TicketColumnProps) {
  const { t } = useTranslation("tickets");
  const [over, setOver] = useState(false);

  const dragHandlers = canDrop
    ? {
        onDragOver: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (!over) setOver(true);
        },
        onDragLeave: (e: DragEvent<HTMLElement>) => {
          // Passer d'un enfant à l'autre déclenche aussi dragleave : on ne
          // relâche le surlignage qu'en sortant vraiment de la colonne.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          setOver(false);
        },
        onDrop: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData("text/plain");
          if (id) onDrop(id, status);
        },
      }
    : {};

  return (
    <section
      aria-label={t(TICKET_STATUS_LABEL_KEYS[status])}
      {...dragHandlers}
      className={`flex flex-col rounded-xl border p-3 transition-colors ${
        over ? "border-line-focus bg-fill-soft" : "border-line-subtle bg-fill-faint"
      } ${single ? "" : "max-h-[70vh]"}`}
    >
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[status].dot}`} aria-hidden />
        <h3 className="text-sm font-semibold text-content-primary">{t(TICKET_STATUS_LABEL_KEYS[status])}</h3>
        <span className="ml-auto rounded-md bg-fill-subtle px-2 py-0.5 text-xs text-content-tertiary">
          {tickets.length}
        </span>
      </header>
      <div className="flex min-h-[4rem] flex-col gap-2 overflow-y-auto">
        {isLoading && [0, 1, 2].map((i) => <Shimmer key={i} height="88px" />)}
        {!isLoading && tickets.length === 0 && (
          <p className="py-8 text-center text-xs text-content-quaternary">{t("noTicketsInColumn")}</p>
        )}
        {!isLoading &&
          tickets.map((tk) => (
            <TicketCard key={tk.id} ticket={tk} scope={scope} draggable={canDrop} onOpen={onOpen} />
          ))}
      </div>
    </section>
  );
}
