import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export type CollectionRemovalKind = "watchlist" | "favorites";

/**
 * Un retrait EN LOT (sélection multiple) de Ma liste ou des favoris se
 * confirme : un seul appui sur la barre retirait toute la sélection, sans
 * filet. Le retrait d'un seul titre garde son « Annuler » ; le lot n'en a pas.
 */
export function useRemovalConfirm(onConfirm: () => void) {
  const [open, setOpen] = useState(false);
  const request = useCallback(() => setOpen(true), []);
  const cancel = useCallback(() => setOpen(false), []);
  const confirm = useCallback(() => {
    setOpen(false);
    onConfirm();
  }, [onConfirm]);
  return { open, request, cancel, confirm };
}

export function CollectionRemovalDialog({ kind, count, confirmation }: {
  kind: CollectionRemovalKind;
  count: number;
  confirmation: ReturnType<typeof useRemovalConfirm>;
}) {
  const { t } = useTranslation("common");
  const title = kind === "watchlist" ? "removeFromWatchlistTitle" : "removeFromFavoritesTitle";
  return (
    <ConfirmDialog
      open={confirmation.open}
      title={t(title, { count })}
      message={t("removeFromCollectionBody")}
      confirmLabel={t("removeCount", { count })}
      cancelLabel={t("cancel")}
      onConfirm={confirmation.confirm}
      onCancel={confirmation.cancel}
      danger
    />
  );
}
