// Cartes hors bibliothèque : ce qu'une extension dit et fait d'un titre (champ
// `titles` du manifeste), et « Ma liste à l'arrivée » par identité TMDB.
export { useTitleState, useRequestTitle, titleStateQueryKey } from "../titles/useTitleState";
export { loadTitleState, type TitleFetcher } from "../titles/titleStateBatcher";
export { useIsWatchlistPending, useWatchlistByTmdb, WATCHLIST_PENDING_KEY } from "../hooks/useWatchlistPending";
