import { useTranslation } from "react-i18next";
import { useTicketDetail } from "@tentacle-tv/api-client";
import { Sheet } from "../ui/Sheet";
import { Spinner } from "../ui/Spinner";
import { EmptyState } from "../ui/EmptyState";
import { useIsMobile } from "../../hooks/useIsMobile";
import { TicketThread } from "./TicketThread";
import { TicketReplyForm } from "./TicketReplyForm";
import { TicketStatusControl } from "./TicketStatusControl";
import { STATUS_STYLE, TICKET_CATEGORY_LABEL_KEYS, TICKET_STATUS_LABEL_KEYS, type TicketStatus } from "./ticketMeta";
import type { TicketBoardScope } from "./useTicketBoard";

interface TicketDetailSheetProps {
  ticketId: string | null;
  scope: TicketBoardScope;
  canMove: boolean;
  onMove: (id: string, status: TicketStatus) => void;
  onClose: () => void;
}

/** Hauteur de la fiche sur téléphone : presque tout l'écran, clavier compris. */
const MOBILE_HEIGHT_RATIO = 0.92;
const DESKTOP_WIDTH = 520;

/**
 * La fiche d'un ticket, en volet latéral (bureau) ou en feuille basse
 * (téléphone). Ouverte par `?ticketId=` — donc aussi par le lien d'une
 * notification, et fermée par le retour navigateur.
 */
export function TicketDetailSheet({ ticketId, scope, canMove, onMove, onClose }: TicketDetailSheetProps) {
  const { t } = useTranslation("tickets");
  const isMobile = useIsMobile();
  const { data: ticket, isLoading, isError } = useTicketDetail(ticketId ?? undefined);
  const size = isMobile ? Math.round(window.innerHeight * MOBILE_HEIGHT_RATIO) : DESKTOP_WIDTH;

  return (
    <Sheet open={!!ticketId} onClose={onClose} placement={isMobile ? "bottom" : "right"} size={size}>
      <div className="flex flex-col" style={{ height: isMobile ? size : "100%" }}>
        <header className="flex items-start gap-3 border-b border-line-subtle px-5 py-4">
          <div className="min-w-0 flex-1">
            {ticket && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-content-primary">{ticket.subject}</h2>
                  <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[ticket.status].chip}`}>
                    {t(TICKET_STATUS_LABEL_KEYS[ticket.status])}
                  </span>
                </div>
                <p className="mt-1 text-xs text-content-quaternary">
                  {t(TICKET_CATEGORY_LABEL_KEYS[ticket.category] ?? "")} — {new Date(ticket.createdAt).toLocaleDateString()}
                  {scope === "all" && ` — ${t("by", { username: ticket.username })}`}
                </p>
                {ticket.mediaItemName && <p className="mt-1 text-xs text-[var(--brand)]">{ticket.mediaItemName}</p>}
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:close")}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {canMove && ticket && (
          <div className="border-b border-line-subtle px-5 py-3">
            <TicketStatusControl value={ticket.status} onChange={(status) => onMove(ticket.id, status)} />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}
          {isError && <EmptyState title={t("ticketNotFound")} />}
          {ticket && <TicketThread messages={ticket.messages ?? []} />}
        </div>

        {ticket &&
          (ticket.status === "closed" ? (
            <p className="border-t border-line-subtle px-5 py-4 text-sm text-content-quaternary">{t("ticketClosed")}</p>
          ) : (
            <TicketReplyForm ticketId={ticket.id} />
          ))}
      </div>
    </Sheet>
  );
}
