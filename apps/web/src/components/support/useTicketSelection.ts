import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDeleteTickets } from "@tentacle-tv/api-client";
import { useMultiSelect } from "../../hooks/useMultiSelect";
import { useToast } from "../../contexts/ToastContext";

/**
 * Sélection multiple des cartes par l'admin, pour supprimer plusieurs
 * tickets d'un coup : mode sélection, cases sur les cartes, barre d'actions
 * commune (SelectionToolbar) et confirmation avant l'irréversible.
 */
export function useTicketSelection() {
  const { t } = useTranslation("tickets");
  const { show } = useToast();
  const sel = useMultiSelect();
  const [confirming, setConfirming] = useState(false);
  const del = useDeleteTickets();

  const requestDelete = useCallback(() => {
    if (sel.count > 0) setConfirming(true);
  }, [sel.count]);

  const confirmDelete = useCallback(() => {
    del.mutate([...sel.selected], {
      onSuccess: () => {
        setConfirming(false);
        sel.exitSelectionMode();
      },
      onError: () => {
        setConfirming(false);
        show("error", t("deleteFailed"));
      },
    });
  }, [del, sel, show, t]);

  return {
    ...sel,
    confirming,
    cancelDelete: () => setConfirming(false),
    requestDelete,
    confirmDelete,
    isDeleting: del.isPending,
  };
}
