import { memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Compass, Heart, Layers, Share2, Sparkles } from "lucide-react";
import { CollectionEmpty } from "../collection/CollectionStates";

/**
 * Mes favoris, VIDE — la liste n'a encore jamais rien reçu.
 *
 * Le cadre commun des collections (`CollectionEmpty`), plus ce que la page
 * fera une fois remplie, en trois étapes, et deux sorties : le catalogue
 * (appel principal) et les recommandations. Une liste filtrée à zéro n'arrive
 * jamais ici : elle a son propre message. `extra` garde le partage : le lien
 * public montre aussi les likes du catalogue, il a un sens même quand cette
 * liste-ci est vide.
 */
export const FavoritesEmpty = memo(function FavoritesEmpty({ extra }: { extra?: ReactNode }) {
  const { t } = useTranslation("favorites");
  const navigate = useNavigate();
  return (
    <CollectionEmpty
      icon={Heart}
      title={t("emptyTitle")}
      body={t("emptyBody")}
      steps={[
        { icon: Heart, label: t("emptyStepLike") },
        { icon: Layers, label: t("emptyStepGroup") },
        { icon: Share2, label: t("emptyStepShare") },
      ]}
      primary={{ label: t("emptyBrowse"), icon: Compass, onClick: () => navigate("/") }}
      secondary={{ label: t("emptyForYou"), icon: Sparkles, onClick: () => navigate("/recommendations") }}
      extra={extra}
    />
  );
});
