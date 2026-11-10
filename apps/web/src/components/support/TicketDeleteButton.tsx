import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
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
  // Clé plurielle (deleteTicket_one / _other) : le compte est obligatoire.
  const label = t("deleteTicket", { count: 1 });

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={label}
        title={label}
        className="icon-btn btn-sm hover:bg-status-error-bg hover:text-status-error-fg"
      >
        <TrashIcon size={16} aria-hidden />
      </button>
      <ConfirmDialog
        open={confirming}
        title={t("deleteConfirmTitle", { count: 1 })}
        message={t("deleteConfirmBody")}
        confirmLabel={label}
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
