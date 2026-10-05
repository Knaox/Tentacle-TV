/**
 * Le focus de la recherche d'un téléviseur — ses clés, son entrée, où mènent
 * la validation et la fermeture du clavier, ce que fait OK sur le meilleur
 * résultat (OK sur une carte : `cards/cardPress`).
 * Module pur : la plateforme pose le focus, ouvre le clavier, navigue.
 *
 * La page, façon Netflix : à gauche la SAISIE (le champ, qui ouvre le clavier
 * système et sa dictée, puis le clavier à l'écran en grille, puis les
 * suggestions), à droite les RÉSULTATS en rangées. Chaque colonne garde sa
 * place : aller aux résultats rend le dernier visité, revenir à la saisie la
 * dernière touche (deux groupes qui mémorisent).
 */

/** Le champ : un bouton qui ouvre le clavier système (et sa dictée). */
export const SEARCH_FIELD_KEY = "search:field";

/** La première touche du clavier à l'écran. */
export const SEARCH_FIRST_KEY = "key:A";

/** La colonne de la saisie (champ, clavier, suggestions), qui mémorise. */
export const SEARCH_INPUT_GROUP = "search:input";

/** La colonne des résultats, qui mémorise. */
export const SEARCH_RESULTS_GROUP = "search:results";

/** L'arrivée sur la recherche : la première touche, pas le champ (RE-1). */
export const SEARCH_ENTRY_KEY = SEARCH_FIRST_KEY;

/** Menu a fermé le clavier système sans valider : la première touche (RE-6). */
export const SEARCH_KEYBOARD_CLOSED_KEY = SEARCH_FIRST_KEY;

/**
 * Où le focus se pose RÉELLEMENT après RE-6 sur l'Apple TV, la référence : le
 * CHAMP. UIKit rend le focus à ce qui avait présenté le clavier, après la
 * réclamation de la première touche (constat 4 de `ecrans.md`, mesuré au
 * simulateur et sur l'appareil). Une plateforme qui ne rend pas le focus
 * d'elle-même (Android TV) réclame celui-ci, pour finir au même endroit.
 */
export const SEARCH_KEYBOARD_CLOSED_LANDING = SEARCH_FIELD_KEY;

/**
 * Le PREMIER résultat d'une page de rangées, dans leur ordre d'affichage : le
 * meilleur résultat (`top`), sinon la première carte de la première rangée —
 * la rangée « À demander » comprise quand elle est seule (RE-5).
 */
export function searchFirstResultKey(sectionKeys: readonly string[]): string | null {
  const first = sectionKeys[0];
  if (first === undefined) return null;
  return first === "top" ? "top" : `${first}:0`;
}

/** OK sur le meilleur résultat : une personne → sa filmographie, un titre → sa fiche. */
export function searchTopPress(kind: string): "browse" | "detail" {
  return kind === "person" ? "browse" : "detail";
}

/** Le geste qui choisit quelque chose dans la recherche. */
export type SearchPick =
  /** Une carte, le meilleur résultat, une personne, un genre ou un studio TROUVÉS. */
  | "result"
  /** Un genre de la page de découverte (rien de tapé, ou rien trouvé). */
  | "discoverGenre"
  /** Une suggestion ou une recherche récente : elle remplace la saisie. */
  | "suggestion";

/** En deçà, une saisie ne vaut pas d'être ressortie. */
export const SEARCH_REMEMBER_MIN_LENGTH = 2;

/**
 * La requête entre dans les recherches récentes à la SÉLECTION d'un résultat
 * seulement — pas à la frappe : une requête abandonnée en route n'a rien
 * donné, la ressortir serait un mauvais conseil (RE-11).
 */
export function searchRemembers(pick: SearchPick, debounced: string): boolean {
  return pick === "result" && debounced.length >= SEARCH_REMEMBER_MIN_LENGTH;
}
