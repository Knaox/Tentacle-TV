/**
 * Les clés du RAIL — ses entrées, et les clés de focus qui les portent.
 *
 * Une entrée a une clé (`Home`, `Library_<id>`…) ; sa cible de focus porte
 * `nav:<clé>`. Le menu d'une entrée a ses lignes sous `nav:menu:<action>` :
 * des clés de la navigation, le rail reste ouvert derrière.
 *
 * Module pur.
 */

export const NAV_PREFIX = "nav:";
export const NAV_MENU_PREFIX = "nav:menu:";

export const RAIL_SEARCH_KEY = "Search";
export const RAIL_HOME_KEY = "Home";
/** « Tout afficher » : paraît dès qu'une entrée est masquée. */
export const RAIL_SHOW_ALL_KEY = "RailShowAll";
/** Le profil, en bas : les réglages. */
export const RAIL_PROFILE_KEY = "Settings";
/** L'aperçu des demandes en cours (Vigie), au-dessus du profil. */
export const RAIL_REQUESTS_KEY = "Requests";
/** « Changer de profil » (Famille, Apple TV), juste au-dessus du profil : « Qui regarde ? ». */
export const RAIL_SWITCH_PROFILE_KEY = "SwitchProfile";

/** Les entrées fixes qu'on peut quand même masquer et déplacer. */
export const RAIL_MOVABLE_FIXED: readonly string[] = ["Recommendations", "Watchlist", "Favorites"];

const LIBRARY_PREFIX = "Library_";

/**
 * Ce qui ne bouge jamais et reste INFOCALISABLE pendant un déplacement :
 * HAUT / BAS ne sortent pas de la liste. (L'aperçu des demandes l'est aussi,
 * par son propre câblage.)
 */
export const RAIL_LOCKED_WHILE_MOVING: readonly string[] = [RAIL_SEARCH_KEY, RAIL_HOME_KEY, RAIL_SHOW_ALL_KEY, RAIL_SWITCH_PROFILE_KEY, RAIL_PROFILE_KEY];

export const navKeyOf = (entryKey: string): string => `${NAV_PREFIX}${entryKey}`;

export const isNavKey = (focusKey: string | null | undefined): boolean => !!focusKey?.startsWith(NAV_PREFIX);

export const isNavMenuKey = (focusKey: string | null | undefined): boolean => !!focusKey?.startsWith(NAV_MENU_PREFIX);

/** L'entrée que porte une clé de focus du rail, ou null hors du rail. */
export function navEntryOf(focusKey: string): string | null {
  return isNavKey(focusKey) ? focusKey.slice(NAV_PREFIX.length) : null;
}

export const libraryRailKey = (libraryId: string): string => `${LIBRARY_PREFIX}${libraryId}`;

/** La bibliothèque d'une entrée `Library_<id>`, ou null. */
export function libraryIdOf(entryKey: string): string | null {
  return entryKey.startsWith(LIBRARY_PREFIX) ? entryKey.slice(LIBRARY_PREFIX.length) : null;
}

/**
 * Une entrée qu'on peut masquer et déplacer : Pour vous, Ma liste, Favoris,
 * chaque bibliothèque. Rechercher, Accueil, « Tout afficher » et le profil
 * n'en sont pas : la navigation ne doit jamais devenir une impasse.
 */
export function isMovableRailKey(entryKey: string): boolean {
  return RAIL_MOVABLE_FIXED.includes(entryKey) || entryKey.startsWith(LIBRARY_PREFIX);
}
