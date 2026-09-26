import { useTranslation } from "react-i18next";
import { useTicketDetail } from "@tentacle-tv/api-client";
import { useContentPadding } from "../../../useMirrorLayout";
import { BackButton } from "../shared/ScreenTitle";
import { Spinner } from "../shared/Spinner";
import { Badge } from "./Badge";
import { MessageBubble } from "./MessageBubble";
import { TicketCloseButton } from "./TicketCloseButton";
import { TicketReplyBar } from "./TicketReplyBar";
import { TicketStatusPicker } from "./TicketStatusPicker";
import { STATUS_VARIANT, TICKET_STATUS_LABEL_KEYS } from "./ticketMeta";

/**
 * `TicketDetailView` de l'app : tête (chevron 40, sujet 18 gras sur une
 * ligne, badge ; « par X » pour l'admin) sous un filet ; sélecteur de statut
 * pour l'admin ; fil de bulles espacées de 10 ; fermeture par l'auteur ;
 * barre de réponse, ou la mention « ticket fermé ».
 */
export function TicketDetailView({ ticketId, isAdmin, onBack }: {
  ticketId: string;
  isAdmin: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation("tickets");
  const pad = useContentPadding(720);
  const { data: ticket, isLoading } = useTicketDetail(ticketId);

  if (isLoading || !ticket) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: "50vh" }}>
        <Spinner size={32} />
      </div>
    );
  }

  const status = ticket.status in STATUS_VARIANT ? ticket.status : "open";
  const isClosed = ticket.status === "closed";

  return (
    <div className="flex flex-col">
      <div className="border-b border-line-subtle" style={{ paddingTop: 12, paddingBottom: 12, paddingLeft: pad, paddingRight: pad }}>
        <div className="flex items-center" style={{ gap: 8 }}>
          <BackButton onPress={onBack} label={t("common:back")} />
          <h1 className="min-w-0 flex-1 truncate font-bold text-content-primary" style={{ fontSize: 18, letterSpacing: -0.2 }}>
            {ticket.subject}
          </h1>
          <Badge label={t(TICKET_STATUS_LABEL_KEYS[status])} variant={STATUS_VARIANT[status]} />
        </div>
        {isAdmin && (
          <p className="truncate text-content-tertiary" style={{ marginTop: 4, fontSize: 12 }}>
            {t("by", { username: ticket.username })}
          </p>
        )}
      </div>

      {isAdmin && <TicketStatusPicker ticketId={ticket.id} status={status} />}

      <div className="flex flex-col" style={{ gap: 10, padding: `16px ${pad}px` }}>
        {(ticket.messages ?? []).map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
      </div>

      {!isClosed && !isAdmin && <TicketCloseButton ticketId={ticketId} />}
      {!isClosed ? (
        <TicketReplyBar ticketId={ticketId} />
      ) : (
        <p className="text-center font-medium text-content-tertiary" style={{ padding: "16px 16px 12px", fontSize: 13 }}>
          {t("ticketClosed")}
        </p>
      )}
    </div>
  );
}
