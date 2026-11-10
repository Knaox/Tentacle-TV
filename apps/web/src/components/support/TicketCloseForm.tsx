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
          className="btn btn-ghost btn-sm -ml-3 hover:text-status-error-fg"
        >
          {t("closeTicket")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border-t border-line-subtle bg-surface-2 px-5 py-4">
      <label className="mb-1.5 block text-xs font-semibold text-content-tertiary" htmlFor="ticket-close-reason">
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
        className="field resize-none"
      />
      {closeMut.isError && <p className="mt-2 text-xs text-status-error-fg">{t("closeFailed")}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="btn btn-ghost"
        >
          {t("common:cancel")}
        </button>
        <button
          type="submit"
          disabled={!reason.trim() || closeMut.isPending}
          className="btn btn-danger"
        >
          {closeMut.isPending ? t("common:sending") : t("closeConfirm")}
        </button>
      </div>
    </form>
  );
}
