/**
 * Où mène la validation d'une saisie — la touche Entrée ou « Rechercher » du
 * clavier système : aux résultats, s'ils répondent à ce qui est tapé.
 *
 * La recherche système d'Android TV fait de même (leanback,
 * `SearchSupportFragment.focusOnResults`) : valider, c'est dire « j'ai fini de
 * taper, montre-moi ». La LG le fait au premier résultat de sa colonne,
 * l'Apple TV au premier de ses rangées ; la décision, elle, est la même, et
 * elle vit ici pour ne pas dériver d'une cible à l'autre.
 *
 * Trois réponses. `results` : la réponse à la saisie COURANTE est à l'écran,
 * on y va. `none` : rien à atteindre — saisie vide, aucun résultat, requête en
 * échec — le focus reste du côté de la saisie. `pending` : la réponse n'est
 * pas encore là — la dernière lettre est encore dans le délai de frappe, ou
 * la requête en vol — et celle qui arrive dans `SEARCH_SUBMIT_WAIT_MS` y mène
 * encore, tant qu'on n'a pas bougé entre-temps.
 */

export type SearchSubmitAnswer = "results" | "none" | "pending";

export interface SearchSubmitState {
  /** La saisie, telle qu'affichée dans la barre. */
  typed: string;
  /** Celle que porte la requête, une fois le délai de frappe écoulé. */
  debounced: string;
  /** La réponse affichée est celle de `debounced`, pas d'une frappe précédente. */
  current: boolean;
  fetching: boolean;
  failed: boolean;
  /** Rangées de résultats à l'écran. */
  sections: number;
}

/**
 * Au-delà, une réponse n'emmène plus le focus : un focus qui saute sans geste
 * est pire qu'un appui de plus.
 */
export const SEARCH_SUBMIT_WAIT_MS = 3000;

/** Pur : la réponse à ce qui est tapé À L'INSTANT — pas à la frappe d'avant. */
export function searchSubmitAnswer(state: SearchSubmitState): SearchSubmitAnswer {
  const typed = state.typed.trim();
  if (!typed || state.failed) return "none";
  if (state.debounced !== typed || !state.current) return "pending";
  if (state.sections > 0) return "results";
  return state.fetching ? "pending" : "none";
}
