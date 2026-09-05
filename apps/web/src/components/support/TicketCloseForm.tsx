import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useCloseTicket } from "@tentacle-tv/api-client";

/**
 * L'auteur ferme son ticket — après confirmation, et en disant pourquoi : le
 * motif est OBLIGATOIRE, il part dans le fil comme un message et les admins
 * en sont prévenus.
 */
export function TicketCloseForm({ ticketId }: { ticketId: string }) {
  const { t } = useTranslation("tickets");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const closeMut = useCloseTicket();

  const cancel = () => {
    setOpen(false);
    setReason("");
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    closeMut.mutate({ ticketId, reason: trimmed }, { onSuccess: cancel });
  };

  if (!open) {
    return (
      <div className="border-t border-line-subtle px-5 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-content-tertiary transition-colors hover:text-status-error-fg"
        >
          {t("closeTicket")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t border-line-subtle bg-fill-faint px-5 py-4">
      <label className="block text-sm font-medium text-content-primary" htmlFor="ticket-close-reason">
        {t("closeReasonLabel")}
      </label>
      <textarea
        id="ticket-close-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("closeReasonPlaceholder")}
        rows={3}
        maxLength={2000}
        required
        autoFocus
        className="mt-2 w-full resize-none rounded-lg border border-line-subtle bg-tentacle-surface px-4 py-2.5 text-sm text-content-primary placeholder-content-quaternary outline-none focus:ring-1 focus:ring-[rgba(var(--brand-rgb),0.5)]"
      />
      {closeMut.isError && <p className="mt-2 text-xs text-status-error-fg">{t("closeFailed")}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="h-11 rounded-lg border border-line-subtle bg-fill-soft px-4 text-sm font-semibold text-content-primary hover:bg-fill-medium"
        >
          {t("common:cancel")}
        </button>
        <button
          type="submit"
          disabled={!reason.trim() || closeMut.isPending}
          className="h-11 rounded-lg bg-status-error-bg px-4 text-sm font-bold text-status-error-fg hover:opacity-90 disabled:opacity-50"
        >
          {closeMut.isPending ? t("common:sending") : t("closeConfirm")}
        </button>
      </div>
    </form>
  );
}
