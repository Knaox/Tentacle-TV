import { useTranslation } from "react-i18next";
import { useUpdateTicketStatus } from "@tentacle-tv/api-client";
import { useToast } from "../../../../contexts/ToastContext";
import { Chip } from "./Chip";
import { TICKET_STATUSES, TICKET_STATUS_LABEL_KEYS, type TicketStatus } from "./ticketMeta";

/**
 * `TicketStatusPicker` de l'app (admin) : une rangée de chips à 16 du bord,
 * 10 au-dessus et dessous ; le courant en surbrillance. Même mutation
 * optimiste que le tableau du bureau ; l'échec s'annonce (l'`Alert` de l'app).
 */
export function TicketStatusPicker({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const { t } = useTranslation("tickets");
  const { show } = useToast();
  const update = useUpdateTicketStatus();

  return (
    <div
      className="mirror-no-scrollbar flex items-center overflow-x-auto"
      style={{ padding: "10px 16px", gap: 8 }}
      role="group"
      aria-label={t("changeStatus")}
    >
      {TICKET_STATUSES.map((s) => (
        <Chip
          key={s}
          label={t(TICKET_STATUS_LABEL_KEYS[s])}
          active={s === status}
          onPress={() => {
            if (s === status || update.isPending) return;
            update.mutate({ ticketId, status: s }, { onError: () => show("error", t("statusUpdateFailed")) });
          }}
        />
      ))}
    </div>
  );
}
