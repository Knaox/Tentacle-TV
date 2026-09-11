import { useWatchlistAll, useBatchRemoveWatchlist } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { ShareMyListButton } from "@/components/watchlist/ShareMyListButton";
import { CollectionScreen } from "./collection/CollectionScreen";

/**
 * « Ma liste ». Tout le rendu vit dans `CollectionScreen`, que Mes favoris
 * partage : les deux écrans étaient des copies l'une de l'autre à quatre points
 * près, et leur ajouter les filtres aurait doublé le travail — puis la dette.
 */
export function WatchlistScreen() {
  const { t } = useTranslation("common");
  return (
    <CollectionScreen
      query={useWatchlistAll()}
      batchRemove={useBatchRemoveWatchlist()}
      title={t("myList")}
      titleIcon="bookmark"
      emptyTitle={t("emptyWatchlist")}
      emptyHint={t("emptyWatchlistHint")}
      action={<ShareMyListButton />}
    />
  );
}
