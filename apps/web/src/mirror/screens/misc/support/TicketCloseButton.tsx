import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloseTicket } from "@tentacle-tv/api-client";
import { useToast } from "../../../../contexts/ToastContext";

const LABEL = { fontSize: 13, fontWeight: 600 } as const;

/**
 * `TicketCloseButton` de l'app : un lien 13 tertiaire qui déplie un motif
 * OBLIGATOIRE (champ de 72, rayon 8), puis Annuler / Fermer (44, rayon 8,
 * rouge). Le motif part dans le fil ; les admins en sont prévenus.
 */
export function TicketCloseButton({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const { show } = useToast();
  const close = useCloseTicket();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block text-content-tertiary active:opacity-70"
        style={{ ...LABEL, padding: "10px 16px" }}
      >
        {t("closeTicket")}
      </button>
    );
  }

  const disabled = !reason.trim() || close.isPending;
  const submit = () => {
    if (disabled) return;
    close.mutate(
      { ticketId, reason: reason.trim() },
      {
        onSuccess: () => { setOpen(false); setReason(""); },
        onError: () => show("error", t("closeFailed")),
      },
    );
  };

  return (
    <div className="flex flex-col border-t border-line-subtle" style={{ padding: "12px 16px", gap: 10 }}>
      <label htmlFor="mirror-ticket-close" className="text-content-primary" style={LABEL}>{t("closeReasonLabel")}</label>
      <textarea
        id="mirror-ticket-close"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={2000}
        autoFocus
        placeholder={t("closeReasonPlaceholder")}
        className="w-full resize-none rounded-lg border border-line-subtle bg-fill-subtle text-content-primary outline-none placeholder:text-content-quaternary"
        style={{ minHeight: 72, padding: "10px 14px", fontSize: 16 }}
      />
      <div className="flex justify-end" style={{ gap: 8 }}>
        <button
          type="button"
          onClick={() => { setOpen(false); setReason(""); }}
          className="rounded-lg bg-fill-subtle text-content-secondary active:opacity-80"
          style={{ ...LABEL, minHeight: 44, padding: "0 16px" }}
        >
          {t("common:cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled}
          className="rounded-lg text-cta-brand-fg active:opacity-[0.85]"
          style={{ ...LABEL, minHeight: 44, padding: "0 16px", background: "var(--status-error)", ...(disabled ? { opacity: 0.4 } : null) }}
        >
          {t("closeConfirm")}
        </button>
      </div>
    </div>
  );
}
