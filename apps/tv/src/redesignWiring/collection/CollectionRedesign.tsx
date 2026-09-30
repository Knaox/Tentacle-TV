import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useWatchlistAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { railNavigate } from "../../navigation/railNavigate";
import { CollectionView, type CollectionEmptyModel } from "../../redesign/screens/collection/CollectionView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { usePosterGrid } from "../grid/usePosterGrid";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";

type Kind = "watchlist" | "favorites";

interface CollectionQuery {
  data: MediaItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

const goHome = () => railNavigate("Home");

/**
 * Ma liste et Favoris, refondus (Apple TV) : toute la collection en grandes
 * affiches (`CollectionView`), sur les mêmes requêtes que l'écran d'Android
 * TV (`useWatchlistAll`, `Filters=Likes` ; `useFavoritesAll`,
 * `Filters=IsFavorite`). Ce que l'ancien écran n'avait pas : l'erreur, qui
 * s'y lisait comme une collection vide. Vide, la page offre une sortie
 * (« Parcourir les bibliothèques ») — un écran sans focalisable serait muet.
 */
function CollectionRedesign({ kind, query }: { kind: Kind; query: CollectionQuery }) {
  const { t } = useTranslation();
  const watchlist = kind === "watchlist";
  const { data, isLoading, isError, refetch } = query;
  const items = useMemo(() => data ?? [], [data]);
  const grid = usePosterGrid(items);

  const loading = isLoading && !data;
  const retry = useCallback(() => void refetch(), [refetch]);
  const status: StatusPanelProps | null = isError && !data
    ? {
        kind: "error",
        title: t("common:contentErrorTitle"),
        message: t("common:contentErrorMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: retry },
        secondary: { label: t("common:backHome"), icon: "home", onPress: goHome },
      }
    : null;
  const empty: CollectionEmptyModel | null = !loading && !status && items.length === 0
    ? {
        icon: watchlist ? "bookmark" : "heart",
        title: t(watchlist ? "common:emptyWatchlist" : "common:emptyFavorites"),
        message: t(watchlist ? "common:emptyWatchlistHint" : "common:emptyFavoritesHint"),
        actionLabel: t("common:browseLibraries"),
      }
    : null;

  const screen = useRedesignScreen({
    railKey: watchlist ? "Watchlist" : "Favorites",
    entryKey: status ? "status:primary" : empty ? "empty:primary" : grid.cards.length > 0 ? "grid:0" : null,
  });

  return (
    <RedesignScreen screen={screen}>
      <CollectionView
        nav={screen.nav}
        kicker={t(watchlist ? "watchlist:kicker" : "favorites:kicker")}
        title={t(watchlist ? "common:myList" : "common:myFavorites")}
        count={t("library:titles", { count: items.length })}
        cards={grid.cards}
        palette={grid.palette}
        loading={loading}
        empty={empty}
        status={status}
        onEmptyAction={goHome}
        onPressCard={grid.onPressCard}
        onLongPressCard={grid.onLongPressCard}
        onFocusCard={grid.onFocusCard}
      />
      {grid.sheet}
    </RedesignScreen>
  );
}

export function WatchlistRedesign() {
  return <CollectionRedesign kind="watchlist" query={useWatchlistAll()} />;
}

export function FavoritesRedesign() {
  return <CollectionRedesign kind="favorites" query={useFavoritesAll()} />;
}
