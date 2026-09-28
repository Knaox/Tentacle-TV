import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Compass, Heart, Layers, Share2, Sparkles } from "lucide-react";
import { CollectionEmptyState } from "../collection/CollectionStates";
import { ShareMyListButton } from "../collection/ShareMyListButton";

/**
 * Mes favoris vide (`favorites/FavoritesEmptyState` de l'app) : l'état vide
 * commun des collections, avec les trois étapes de la page — dont le partage,
 * désormais proposé aussi sur téléphone (le lien public montre les likes du
 * catalogue : il a un sens même quand cette liste-ci est vide).
 */
export const FavoritesEmptyState = memo(function FavoritesEmptyState() {
  const { t } = useTranslation("favorites");
  const navigate = useNavigate();
  return (
    <CollectionEmptyState
      Icon={Heart}
      title={t("emptyTitle")}
      body={t("emptyBody")}
      steps={[
        { Icon: Heart, label: t("emptyStepLike") },
        { Icon: Layers, label: t("emptyStepGroup") },
        { Icon: Share2, label: t("emptyStepShare") },
      ]}
      primary={{ label: t("emptyBrowse"), Icon: Compass, onPress: () => navigate("/libraries") }}
      secondary={{ label: t("emptyForYou"), Icon: Sparkles, onPress: () => navigate("/recommendations") }}
      extra={<ShareMyListButton kind="likes" />}
    />
  );
});
