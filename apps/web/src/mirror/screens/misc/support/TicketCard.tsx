import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, MessageCircle, User } from "lucide-react";
import type { SupportTicket } from "@tentacle-tv/api-client";
import { Badge } from "./Badge";
import { categoryLabelKey, STATUS_VARIANT, TICKET_STATUS_LABEL_KEYS } from "./ticketMeta";

/**
 * `TicketCard` de l'app : surface s1, filet subtil, rayon 12, padding 16 ;
 * sujet 15 semi-gras sur une ligne + badge de statut ; méta à 10 dessous
 * (catégorie, auteur pour l'admin, date, messages — icônes 11, texte 12).
 */
export const TicketCard = memo(function TicketCard({ ticket, showAuthor, onOpen }: {
  ticket: SupportTicket;
  showAuthor: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("tickets");
  const catKey = categoryLabelKey(ticket.category);
  const status = ticket.status in STATUS_VARIANT ? ticket.status : "open";

  return (
    <button
      type="button"
      onClick={() => onOpen(ticket.id)}
      aria-label={ticket.subject}
      className="mirror-dim block w-full rounded-xl border border-line-subtle bg-surface-1 text-left"
      style={{ padding: 16 }}
    >
      <div className="flex items-center justify-between" style={{ gap: 12 }}>
        <span className="min-w-0 flex-1 truncate font-semibold text-content-primary" style={{ fontSize: 15, letterSpacing: -0.1 }}>
          {ticket.subject}
        </span>
        <Badge label={t(TICKET_STATUS_LABEL_KEYS[status])} variant={STATUS_VARIANT[status]} />
      </div>
      <div className="flex flex-wrap items-center" style={{ marginTop: 10, gap: 10 }}>
        <Badge label={catKey ? t(catKey) : ticket.category} />
        {showAuthor && <Meta icon={<User size={11} />} text={ticket.username} />}
        <Meta icon={<Clock size={11} />} text={new Date(ticket.updatedAt).toLocaleDateString()} />
        {ticket._count && (
          <Meta icon={<MessageCircle size={11} />} text={t("messagesCount", { count: ticket._count.messages })} />
        )}
      </div>
    </button>
  );
});

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center" style={{ gap: 4 }}>
      <span className="text-content-quaternary">{icon}</span>
      <span className="text-content-tertiary" style={{ fontSize: 12 }}>{text}</span>
    </span>
  );
}
