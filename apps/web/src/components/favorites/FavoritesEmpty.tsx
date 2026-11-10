import { memo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CompassIcon as Compass } from "@phosphor-icons/react/dist/csr/Compass";
import { HeartIcon as Heart } from "@phosphor-icons/react/dist/csr/Heart";
import { StackIcon as Layers } from "@phosphor-icons/react/dist/csr/Stack";
import { ShareNetworkIcon as Share2 } from "@phosphor-icons/react/dist/csr/ShareNetwork";
import { SparkleIcon as Sparkles } from "@phosphor-icons/react/dist/csr/Sparkle";
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
