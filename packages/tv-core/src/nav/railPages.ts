/**
 * Les pages du RAIL — ses destinations, à la manière d'onglets : l'accueil,
 * « Pour vous », la recherche, Ma liste, les favoris, les réglages, une
 * bibliothèque. Retour n'y recule jamais d'une page (`railBackStep`) ; toute
 * autre page est POUSSÉE et recule.
 *
 * Les noms sont ceux des routes de l'app TV (`apps/tv`, la même pile pour
 * Apple TV et Android TV).
 *
 * Module pur.
 */

export const RAIL_PAGES: readonly string[] = ["Home", "Recommendations", "Search", "Watchlist", "Favorites", "Settings", "Library"];

export function isRailPage(routeName: string): boolean {
  return RAIL_PAGES.includes(routeName);
}

/** Une page POUSSÉE : hors des pages du rail, et la pile a de quoi reculer. */
export function isPushedPage(routeName: string, canGoBack: boolean): boolean {
  return !isRailPage(routeName) && canGoBack;
}
