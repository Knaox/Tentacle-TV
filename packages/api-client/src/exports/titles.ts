// Cartes hors bibliothèque : ce qu'une extension dit et fait d'un titre (champ
// `titles` du manifeste), « Ma liste à l'arrivée » et le cœur à l'arrivée, par
// identité TMDB.
export { useTitleState, useRequestTitle, titleStateQueryKey } from "../titles/useTitleState";
// Les saisons d'une série, choisies sur place (route `seasons` du même contrat).
export {
  useTitleSeasons, useRequestTitleSeasons, titleSeasonsQueryKey, type TitleSeasonsFeed,
} from "../titles/useTitleSeasons";
// Ce qui manque aux séries de la bibliothèque (route `gaps`), en une requête par page.
export { useTitleGaps, titleGapsQueryKey, loadTitleGaps } from "../titles/useTitleGaps";
export { useSeriesGaps, type SeriesGap, type SeriesGapItem } from "../titles/useSeriesGaps";
export { loadTitleState, type TitleFetcher } from "../titles/titleStateBatcher";
// Ce que le compte attend (routes `access` et `mine` du même contrat) : son
// droit, et ses titres demandés pas encore arrivés.
export {
  useTitlesAccess, useMyTitles, titlesAccessQueryKey, myTitlesQueryKey, myTitlesKeyOrigin, MY_TITLES_KEY,
  type MyTitlesOptions, type MyTitlesFeed,
} from "../titles/useMyTitles";
export { useIsWatchlistPending, useWatchlistByTmdb, WATCHLIST_PENDING_KEY } from "../hooks/useWatchlistPending";
export { useIsFavoritePending, useFavoriteByTmdb, useLikesAvailable, FAVORITE_PENDING_KEY } from "../hooks/useFavoritePending";
