import type { MediaItem } from "@tentacle-tv/shared";
import type { TFunction } from "i18next";
import type { CollectionEmptyModel } from "../../../src/redesign/screens/collection/CollectionView";
import type { BenchData } from "./benchData";

/**
 * Ma liste et Favoris au banc : la vraie collection du compte (un titre
 * chacune sur Knaoxtest), et un exemple rempli — des COPIES de vrais titres
 * du catalogue, marquées comme la collection les marquerait (`Likes` pour Ma
 * liste, `IsFavorite` pour Favoris), pour voir la page pleine.
 */

export type CollectionKind = "watchlist" | "favorites";

/** Séries et films en alternance : une page variée, comme une vraie liste. */
function mixed(data: BenchData, count: number): MediaItem[] {
  const series = data.list("series");
  const movies = data.list("movies");
  const out: MediaItem[] = [];
  for (let i = 0; out.length < count && (i < series.length || i < movies.length); i++) {
    if (movies[i]) out.push(movies[i]);
    if (series[i] && out.length < count) out.push(series[i]);
  }
  return out;
}

export function exampleCollection(data: BenchData, kind: CollectionKind, count = 16): MediaItem[] {
  const mark = kind === "watchlist" ? { Likes: true } : { IsFavorite: true };
  return mixed(data, count).map((item) => ({ ...item, UserData: { ...item.UserData, ...mark } as MediaItem["UserData"] }));
}

export function collectionTexts(t: TFunction, kind: CollectionKind) {
  const watchlist = kind === "watchlist";
  const empty: CollectionEmptyModel = {
    icon: watchlist ? "bookmark" : "heart",
    title: t(watchlist ? "common:emptyWatchlist" : "common:emptyFavorites"),
    message: t(watchlist ? "common:emptyWatchlistHint" : "common:emptyFavoritesHint"),
    actionLabel: t("common:browseLibraries"),
  };
  return {
    kicker: t(watchlist ? "watchlist:kicker" : "favorites:kicker"),
    title: t(watchlist ? "common:myList" : "common:myFavorites"),
    navKey: watchlist ? "Watchlist" : "Favorites",
    empty,
  };
}
