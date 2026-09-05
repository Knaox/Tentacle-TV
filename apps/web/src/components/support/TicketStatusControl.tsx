import { useTranslation } from "react-i18next";
import { isTicketStatus } from "@tentacle-tv/api-client";
import { TICKET_STATUSES, TICKET_STATUS_LABEL_KEYS, type TicketStatus } from "./ticketMeta";

interface TicketStatusControlProps {
  value: TicketStatus;
  onChange: (status: TicketStatus) => void;
}

/**
 * Le changement de statut qui marche PARTOUT — tactile, clavier, lecteur
 * d'écran. Le glisser-déposer des colonnes n'en est qu'un raccourci.
 */
export function TicketStatusControl({ value, onChange }: TicketStatusControlProps) {
  const { t } = useTranslation("tickets");
  return (
    <label className="flex items-center gap-3 text-xs text-content-tertiary">
      <span>{t("changeStatus")}</span>
      <select
        value={value}
        aria-label={t("changeStatus")}
        onChange={(e) => {
          const next = e.target.value;
          if (isTicketStatus(next) && next !== value) onChange(next);
        }}
        className="h-9 appearance-none rounded-lg border border-line-subtle bg-tentacle-surface px-3 text-sm text-content-primary [&>option]:bg-tentacle-surface [&>option]:text-content-primary"
      >
        {TICKET_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(TICKET_STATUS_LABEL_KEYS[status])}
          </option>
        ))}
      </select>
    </label>
  );
}
