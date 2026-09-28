/**
 * Les familles de requêtes que les bascules d'un titre (Ma liste, favori, vu)
 * patchent et invalident — extraites de `cacheUtils`, qui dépasse sa taille.
 */

/**
 * Préfixes de query keys contenant des listes de MediaItem avec UserData.
 * TanStack Query ne refetch que les queries avec observers actifs → pas d'impact perf.
 */
export const LIST_QUERY_PREFIXES = [
  "favorites",
  "watchlist",
  "latest-items",
  "resume-items",
  "next-up",
  "watched-items",
  "featured",
  "continue-watching",
  "library",
  "episodes",
  "search",
  "similar",
  // Le contenu d'une collection (fiche d'un coffret) : ses cartes suivaient
  // mal une bascule, leur liste n'étant ni patchée ni invalidée.
  "collection-items",
  // Les films d'une saga (rangée de la fiche) — cf. `useSaga.ts`.
  "saga-items",
  "seasons",
  "series-watch-state",
] as const;

/**
 * Les listes dont l'APPARTENANCE dépend de l'état « vu », et non le seul badge.
 *
 * Un patch de `UserData` en cache suffit à corriger une pastille ; il ne sait
 * pas retirer un titre d'une liste ni l'y remettre. « Prochains épisodes » se
 * recompose à partir de trois requêtes serveur (proposition, vivier des non
 * vus, épisodes vus par date) : démarquer un épisode ne le ramenait donc
 * jamais en tête — la rangée restait sur l'épisode d'après jusqu'à ce qu'un
 * hasard la rafraîchisse. Ces listes-là se redemandent vraiment.
 *
 * Seules celles qui ont un observateur actif partent : `refetchType: "active"`.
 */
export const WATCH_COMPOSED_PREFIXES = [
  "next-up",
  "resume-items",
  "watched-items",
  "continue-watching",
  "series-watch-state",
] as const;
