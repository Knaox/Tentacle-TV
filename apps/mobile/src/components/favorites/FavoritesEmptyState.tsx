import { memo } from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { CollectionEmptyState } from "@/components/collection/CollectionStates";
import { ShareMyListButton } from "@/components/watchlist/ShareMyListButton";

/**
 * Mes favoris vide — la liste n'a encore jamais rien reçu. L'état vide commun
 * des collections, avec les trois étapes de la page — dont le partage,
 * désormais proposé aussi sur mobile : le lien public montre les likes du
 * catalogue, il a un sens même quand cette liste-ci est vide. Deux sorties :
 * les bibliothèques et « Pour vous ». Une liste FILTRÉE à zéro n'arrive
 * jamais ici. Même dessin que le miroir web.
 */
export const FavoritesEmptyState = memo(function FavoritesEmptyState() {
  const { t } = useTranslation("favorites");
  const router = useRouter();
  return (
    <CollectionEmptyState
      icon="heart"
      title={t("emptyTitle")}
      body={t("emptyBody")}
      steps={[
        { icon: "heart", label: t("emptyStepLike") },
        { icon: "layers", label: t("emptyStepGroup") },
        { icon: "share-2", label: t("emptyStepShare") },
      ]}
      primary={{ label: t("emptyBrowse"), icon: "compass", onPress: () => router.navigate("/libraries") }}
      secondary={{ label: t("emptyForYou"), icon: "star", onPress: () => router.navigate("/for-you") }}
      extra={<ShareMyListButton kind="likes" />}
    />
  );
});
