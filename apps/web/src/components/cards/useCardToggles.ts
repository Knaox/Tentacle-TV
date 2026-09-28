import {
  useToggleWatchlistForItem,
  useFavoriteForItem,
  useWatchedToggle,
  useWatchlistSeriesIds,
  useFavoriteSeriesIds,
  seriesStateId,
} from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Les trois bascules d'une carte — Ma liste, favori, vu — avec leur état.
 *
 * Extrait de `CardQuickActions` pour que le plateau du survol et les boutons
 * de la bannière lisent la MÊME logique : Ma liste et Favoris agissent au
 * niveau SÉRIE (Sets `watchlist-series-ids` / `favorite-series-ids`), un film
 * répond par son `UserData`. Tout passe par le cache : mises à jour optimistes
 * sans état local.
 *
 * Lit les Sets ENTIERS : ne monter qu'au survol (cf. `PosterTile`). Pour un
 * affichage au repos, c'est `useCardMarkers` qu'il faut — il ne réveille que
 * la carte dont l'état change.
 */
export function useCardToggles(item: MediaItem) {
  const { add: addWatchlist, remove: removeWatchlist } = useToggleWatchlistForItem(item);
  const { add: addFav, remove: removeFav } = useFavoriteForItem(item);
  const { markWatched, markUnwatched } = useWatchedToggle(item.Id, {
    seriesId: item.SeriesId,
    seasonId: item.SeasonId,
    itemType: item.Type,
  });
  const watchlistSeries = useWatchlistSeriesIds();
  const favoriteSeries = useFavoriteSeriesIds();

  // Épisode ET série lisent le Set (cf. `seriesStateId`) : une vignette « +N »
  // des derniers ajouts est fabriquée côté client et ne porte pas le `UserData`
  // de sa série — Ma liste n'y devenait jamais visible.
  const seriesId = seriesStateId(item);
  const inList = seriesId ? watchlistSeries.has(seriesId) : item.UserData?.Likes === true;
  const favorite = seriesId ? favoriteSeries.has(seriesId) : item.UserData?.IsFavorite === true;
  const watched = item.UserData?.Played === true;

  return {
    inList,
    favorite,
    watched,
    toggleList: () => (inList ? removeWatchlist.mutate() : addWatchlist.mutate()),
    toggleFavorite: () => (favorite ? removeFav.mutate() : addFav.mutate()),
    toggleWatched: () => (watched ? markUnwatched.mutate() : markWatched.mutate()),
  };
}

/** Un clic sur un contrôle de carte ne doit jamais naviguer. */
export function stopCardClick(e: React.MouseEvent) {
  e.stopPropagation();
  e.preventDefault();
}
