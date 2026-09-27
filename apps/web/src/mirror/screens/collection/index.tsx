import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { useBatchRemoveFavorites, useFavoritesAll } from "@tentacle-tv/api-client";
import { CollectionScreen } from "./CollectionScreen";
import { MirrorWatchlistScreen } from "../watchlist/WatchlistScreen";

/**
 * Route `/watchlist` — « Ma liste » (`screens/WatchlistScreen` de l'app). Elle
 * a quitté `CollectionScreen` pour son propre écran (`screens/watchlist`) :
 * reprise, étapes de visionnage, vue liste. Mes favoris reste ici.
 */
export function MirrorWatchlist() {
  return <MirrorWatchlistScreen />;
}

/** Route `/favorites` — « Mes favoris » (`screens/FavoritesScreen` de l'app) : même écran, autre source. */
export function MirrorFavorites() {
  const { t } = useTranslation("common");
  return (
    <CollectionScreen
      query={useFavoritesAll()}
      batchRemove={useBatchRemoveFavorites()}
      title={t("myFavorites")}
      Icon={Heart}
      emptyTitle={t("emptyFavorites")}
      emptyHint={t("emptyFavoritesHint")}
    />
  );
}
