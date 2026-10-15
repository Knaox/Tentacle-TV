import { useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

export type CollectionRemovalKind = "watchlist" | "favorites";

/**
 * Un retrait EN LOT (sélection multiple) de Ma liste ou des favoris se
 * confirme : un seul appui sur la barre retirait toute la sélection, sans
 * filet. Le retrait d'un seul titre garde son « Annuler » ; le lot n'en a pas.
 * Mêmes mots que le web (`common`).
 */
export function useCollectionRemovalConfirm(kind: CollectionRemovalKind) {
  const { t } = useTranslation("common");
  return useCallback((count: number, onConfirm: () => void) => {
    if (count === 0) return;
    const title = kind === "watchlist" ? "removeFromWatchlistTitle" : "removeFromFavoritesTitle";
    Alert.alert(t(title, { count }), t("removeFromCollectionBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("removeCount", { count }), style: "destructive", onPress: onConfirm },
    ]);
  }, [kind, t]);
}
