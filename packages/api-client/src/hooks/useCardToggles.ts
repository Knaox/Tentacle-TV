import type { CardToggleKind, CardToggleStates, MediaItem } from "@tentacle-tv/shared";
import { useFavoriteForItem } from "./useFavorite";
import { useFavoriteSeriesIds, useWatchlistSeriesIds, seriesStateId } from "./useSeriesListMembership";
import { useToggleWatchlistForItem } from "./useWatchlist";
import { useWatchedToggle } from "./useWatchedToggle";

export interface CardToggles extends CardToggleStates {
  /** Les trois états, sous la forme que lit `cardActionEntries`. */
  states: CardToggleStates;
  toggle: (kind: CardToggleKind) => void;
  toggleList: () => void;
  toggleFavorite: () => void;
  toggleWatched: () => void;
}

/**
 * Les trois bascules d'une carte — Ma liste, favori, vu — avec leur état : la
 * logique UNIQUE du survol web, de la feuille d'appui long du mobile et du
 * menu de la télécommande (cf. `cardOverlay.ts`).
 *
 * Ma liste et Favoris agissent au niveau SÉRIE (Sets `watchlist-series-ids` /
 * `favorite-series-ids`), un film répond par son `UserData`. « Vu » vise le
 * titre MONTRÉ — l'épisode d'une vignette, pas toute sa série. Tout passe par
 * le cache : mises à jour optimistes, aucun état local, donc la même carte
 * affichée deux fois ne peut pas se contredire.
 *
 * Lit les Sets ENTIERS : ne monter qu'au survol, à l'ouverture d'une feuille
 * ou au focus. Pour un affichage au repos, c'est `useCardMarkers` qu'il faut —
 * il ne réveille que la carte dont l'état change.
 */
export function useCardToggles(item: MediaItem): CardToggles {
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
  const watchlist = seriesId ? watchlistSeries.has(seriesId) : item.UserData?.Likes === true;
  const favorite = seriesId ? favoriteSeries.has(seriesId) : item.UserData?.IsFavorite === true;
  const watched = item.UserData?.Played === true;

  const toggleList = () => (watchlist ? removeWatchlist.mutate() : addWatchlist.mutate());
  const toggleFavorite = () => (favorite ? removeFav.mutate() : addFav.mutate());
  const toggleWatched = () => (watched ? markUnwatched.mutate() : markWatched.mutate());
  const togglers: Record<CardToggleKind, () => void> = {
    watchlist: toggleList,
    favorite: toggleFavorite,
    watched: toggleWatched,
  };

  return {
    watchlist,
    favorite,
    watched,
    states: { watchlist, favorite, watched },
    toggle: (kind) => togglers[kind](),
    toggleList,
    toggleFavorite,
    toggleWatched,
  };
}
