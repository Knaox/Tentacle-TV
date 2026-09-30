/** Une route telle que la pile la décrit. */
export interface RouteLike {
  name: string;
  params?: object;
}

/**
 * L'entrée de la navigation qu'une route allume — « Library_<id> » pour une
 * bibliothèque — ou null pour un écran plein cadre (lecteur, fiche,
 * bande-annonce, jumelage). Une seule table : le rail actuel, les écrans
 * refondus et ce qui les remplace (erreur, chargement) la lisent.
 */
export function routeRailKey(route: RouteLike | null | undefined): string | null {
  if (!route) return null;
  switch (route.name) {
    case "Home": return "Home";
    case "Recommendations": return "Recommendations";
    // L'étagère d'un acteur ou d'un genre est un morceau de la recherche : la
    // navigation y reste, « Rechercher » actif — parité LG.
    case "Search":
    case "SearchBrowse": return "Search";
    case "Watchlist": return "Watchlist";
    case "Favorites": return "Favorites";
    case "Settings": return "Settings";
    case "Library":
      return `Library_${(route.params as { libraryId?: string } | undefined)?.libraryId ?? ""}`;
    default: return null;
  }
}
