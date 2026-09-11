import { useFavoritesAll, useBatchRemoveFavorites } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { CollectionScreen } from "./collection/CollectionScreen";

/** « Mes favoris » — même écran que Ma liste, autre source. */
export function FavoritesScreen() {
  const { t } = useTranslation("common");
  return (
    <CollectionScreen
      query={useFavoritesAll()}
      batchRemove={useBatchRemoveFavorites()}
      title={t("myFavorites")}
      titleIcon="heart"
      emptyTitle={t("emptyFavorites")}
      emptyHint={t("emptyFavoritesHint")}
    />
  );
}
