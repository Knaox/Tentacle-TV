import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeleteTickets } from "@tentacle-tv/api-client";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface TicketDeleteButtonProps {
  ticketId: string;
  /** Après suppression : fermer la fiche. */
  onDeleted: () => void;
}

/** Admin : supprime CE ticket (messages et notifications compris), après confirmation. */
export function TicketDeleteButton({ ticketId, onDeleted }: TicketDeleteButtonProps) {
  const { t } = useTranslation("tickets");
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteTickets();

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t("deleteTicket")}
        title={t("deleteTicket")}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-status-error-bg hover:text-status-error-fg"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      <ConfirmDialog
        open={confirming}
        title={t("deleteConfirmTitle", { count: 1 })}
        message={t("deleteConfirmBody")}
        confirmLabel={t("deleteTicket")}
        cancelLabel={t("common:cancel")}
        danger
        pending={del.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          del.mutate([ticketId], {
            onSuccess: () => {
              setConfirming(false);
              onDeleted();
            },
          })
        }
      />
    </>
  );
}
