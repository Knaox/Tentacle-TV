import { RAIL_HOME_KEY, RAIL_SEARCH_KEY, RAIL_SHOW_ALL_KEY, libraryIdOf, navKeyOf } from "./railKeys";

/**
 * OK sur une entrée du RAIL — module pur. Dans cet ordre :
 *
 * 1. une entrée se déplace : OK la POSE, rien d'autre ;
 * 2. « Tout afficher » : tout réapparaît, et le focus va à l'entrée de la page
 *    (l'entrée choisie disparaît avec ce qu'elle rend) ;
 * 3. Rechercher : revenir à la barre de recherche — sur l'étagère d'une
 *    personne ou d'un genre, la page recule vers la recherche ; sur la
 *    recherche, sa barre reprend le focus. Si ni l'une ni l'autre n'est à
 *    l'écran, la suite (`otherwise`) ;
 * 4. l'entrée de la page où l'on est : la page la reprend (par défaut, le
 *    focus revient au contenu) ;
 * 5. une autre page : on y va, à la manière d'onglets. En quittant l'ACCUEIL,
 *    le focus repasse d'abord dans son contenu, dans le même geste : il reste
 *    monté sous la page choisie, et UIKit lui rendrait au retour le focus
 *    qu'il avait en partant — une entrée du rail, qui rouvrait le rail sur
 *    l'ANCIENNE page.
 */

/** Une page du rail, telle qu'on y navigue. */
export type RailDestination =
  | { route: "Home" | "Search" | "Recommendations" | "Watchlist" | "Favorites" | "Settings" }
  | { route: "Library"; libraryId: string };

const PAGES: readonly string[] = ["Home", "Search", "Recommendations", "Watchlist", "Favorites", "Settings"];

/** La page d'une entrée du rail, ou null (une clé sans page). */
export function railDestinationOf(entryKey: string): RailDestination | null {
  if (PAGES.includes(entryKey)) return { route: entryKey as Exclude<RailDestination["route"], "Library"> };
  const libraryId = libraryIdOf(entryKey);
  return libraryId === null ? null : { route: "Library", libraryId };
}

export type RailSelect =
  | { kind: "drop" }
  | { kind: "showAll"; focus: string }
  | { kind: "searchBar"; otherwise: RailSelect }
  | { kind: "reselect" }
  /** `to` : null pour une clé sans page — rien ne s'ouvre, mais l'accueil a déjà rendu son focus au contenu. */
  | { kind: "navigate"; to: RailDestination | null; refocusContentFirst: boolean };

export function railSelect(state: { key: string; activeKey: string; moving: boolean }): RailSelect {
  const { key, activeKey } = state;
  if (state.moving) return { kind: "drop" };
  if (key === RAIL_SHOW_ALL_KEY) return { kind: "showAll", focus: navKeyOf(activeKey) };
  const page: RailSelect = key === activeKey
    ? { kind: "reselect" }
    : { kind: "navigate", to: railDestinationOf(key), refocusContentFirst: activeKey === RAIL_HOME_KEY };
  return key === RAIL_SEARCH_KEY ? { kind: "searchBar", otherwise: page } : page;
}
