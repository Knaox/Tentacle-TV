import { useTranslation } from "react-i18next";
import { Bookmark, Heart } from "lucide-react";
import { useBatchRemoveFavorites, useBatchRemoveWatchlist, useFavoritesAll, useWatchlistAll } from "@tentacle-tv/api-client";
import { CollectionScreen } from "./CollectionScreen";
import { ShareMyListButton } from "./ShareMyListButton";

/** Route `/watchlist` — « Ma liste » (`screens/WatchlistScreen` de l'app), avec son partage. */
export function MirrorWatchlist() {
  const { t } = useTranslation("common");
  return (
    <CollectionScreen
      query={useWatchlistAll()}
      batchRemove={useBatchRemoveWatchlist()}
      title={t("myList")}
      Icon={Bookmark}
      emptyTitle={t("emptyWatchlist")}
      emptyHint={t("emptyWatchlistHint")}
      action={<ShareMyListButton />}
    />
  );
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
