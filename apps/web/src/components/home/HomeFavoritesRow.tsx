import { useTranslation } from "react-i18next";
import { useFavorites } from "@tentacle-tv/api-client";
import { MediaRow } from "../rows/MediaRow";

/**
 * La rangée « Mes favoris » de l'accueil configurable : les vingt derniers
 * favoris (films et séries), « Tout voir » vers la page Favoris. Le hook ne
 * se monte que si la rangée est active — aucune requête sinon ; sans favori,
 * rien (l'accueil garde son dégradé silencieux).
 */
export function HomeFavoritesRow({ animDelay }: { animDelay: number }) {
  const { t } = useTranslation("common");
  const { data: favorites } = useFavorites();
  if (!favorites?.length) return null;
  return <MediaRow title={t("common:myFavorites")} items={favorites} animDelay={animDelay} href="/favorites" />;
}
