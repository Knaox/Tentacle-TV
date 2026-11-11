import { useTranslation } from "react-i18next";
import { STATUS_STYLE, TICKET_STATUSES, TICKET_STATUS_FILTER_KEYS, type TicketStatus } from "./ticketMeta";

interface TicketStatusTabsProps {
  active: TicketStatus;
  counts: Record<TicketStatus, number>;
  onChange: (status: TicketStatus) => void;
}

/**
 * Le tableau sous 768 px : un onglet par statut, avec son compteur, et une
 * seule colonne dessous. Pas de colonnes à défilement horizontal — elles
 * cacheraient les trois quarts du contenu, et le glisser n'existe pas au
 * tactile de toute façon.
 */
export function TicketStatusTabs({ active, counts, onChange }: TicketStatusTabsProps) {
  const { t } = useTranslation("tickets");
  return (
    <div role="tablist" className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {TICKET_STATUSES.map((status) => {
        const selected = status === active;
        return (
          <button
            key={status}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(status)}
            className={`flex h-9 flex-shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium outline-none transition-[color,background-color,transform] duration-hover active:scale-[var(--press-scale)] focus-visible:ring-2 focus-visible:ring-line-focus ${
              selected
                ? "bg-surface-4 font-semibold text-content-primary"
                : "bg-fill-subtle text-content-secondary hover:bg-fill-soft hover:text-content-primary"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[status].dot}`} aria-hidden />
            {t(TICKET_STATUS_FILTER_KEYS[status])}
            <span className="num rounded-chip bg-fill-soft px-1.5 text-[11px] text-content-tertiary">{counts[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
