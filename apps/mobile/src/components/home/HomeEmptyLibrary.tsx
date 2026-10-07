import { memo } from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { setupDocUrl } from "@tentacle-tv/shared";
import { CollectionEmptyState } from "@/components/collection/CollectionStates";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * L'accueil d'un compte sans AUCUN titre (`libraryHasNoTitles`) : avant, le
 * bandeau et les rangées ne rendaient rien — un écran noir. L'état vide
 * commun des collections, les mêmes mots que le web : l'administrateur a le
 * guide pour ajouter du contenu, les autres le simple constat. « Vérifier à
 * nouveau » relit les bibliothèques ; un ajout le fait aussi tout seul.
 */
export const HomeEmptyLibrary = memo(function HomeEmptyLibrary({ onRecheck }: { onRecheck: () => void }) {
  const { t, i18n } = useTranslation("common");
  const isAdmin = useIsAdmin();
  return (
    <CollectionEmptyState
      icon="film"
      title={t("emptyHomeTitle")}
      body={isAdmin ? t("emptyHomeAdminHint") : t("emptyHomeHint")}
      primary={{ label: t("emptyHomeRefresh"), icon: "refresh-cw", onPress: onRecheck }}
      secondary={
        isAdmin
          ? { label: t("emptyHomeGuide"), icon: "book-open", onPress: () => void Linking.openURL(setupDocUrl("addContent", i18n.language ?? "en")) }
          : undefined
      }
    />
  );
});
