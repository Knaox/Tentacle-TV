import { useCallback, useEffect, useRef, type RefObject } from "react";
import { giveFocus } from "../../focus/active";
import { collect } from "../../focus/candidates";
import type { SearchBarHandle } from "./SearchBarTv";

/**
 * Valider la saisie — la touche Entrée du clavier système — le referme et
 * mène aux résultats.
 *
 * webOS ne congédie pas son clavier à la validation : il reste là tant que le
 * champ a le focus, et la touche Entrée n'arrive à l'application que comme un
 * `keydown` 13 sur ce champ. Rien ne l'écoutait — on tapait, on validait, et
 * le clavier restait posé sur l'écran. Déplacer le focus suffit à le faire
 * descendre : c'est le seul moyen que la plateforme laisse, elle n'expose
 * aucune commande pour le masquer.
 *
 * Où va le focus : au PREMIER résultat — la recherche du système Android TV
 * fait de même (leanback, `SearchSupportFragment.focusOnResults`) — si la
 * réponse à ce qui est tapé est à l'écran. Sinon à la barre, qui montre la saisie et d'où
 * « droite » mène aux résultats. Valider juste après la dernière lettre est
 * le cas courant, et la réponse suit de peu (250 ms de frappe, puis la
 * requête) : si elle arrive pendant qu'on est encore sur la barre, elle y
 * emmène le focus. Pas si l'on a bougé entre-temps, ni trois secondes plus
 * tard — un focus qui saute sans geste est pire qu'un appui de plus.
 */

/** Ce que la surcouche sait de la réponse à la saisie courante. */
export type SubmitAnswer = "results" | "none" | "pending";

export interface AnswerState {
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

/** Pur : la réponse à ce qui est tapé À L'INSTANT — pas à la frappe d'avant. */
export function submitAnswer(state: AnswerState): SubmitAnswer {
  const typed = state.typed.trim();
  if (!typed || state.failed) return "none";
  if (state.debounced !== typed || !state.current) return "pending";
  if (state.sections > 0) return "results";
  return state.fetching ? "pending" : "none";
}

/** Au-delà, une réponse n'emmène plus le focus. */
const LATE_ANSWER_MS = 3000;

export function useSubmitToResults(
  answer: SubmitAnswer,
  results: RefObject<HTMLElement | null>,
  bar: RefObject<SearchBarHandle | null>,
): () => void {
  // Ce qui avait le focus quand on s'est mis à attendre, et depuis quand.
  const waiting = useRef<{ anchor: Element | null; since: number } | null>(null);

  const land = useCallback((): boolean => {
    const zone = results.current;
    const first = zone ? collect(zone)[0] : undefined;
    if (!first) return false;
    giveFocus(first.element);
    return true;
  }, [results]);

  useEffect(() => {
    const pending = waiting.current;
    if (!pending || answer === "pending") return;
    waiting.current = null;
    if (answer !== "results" || Date.now() - pending.since > LATE_ANSWER_MS) return;
    if (document.activeElement === pending.anchor) land();
  }, [answer, land]);

  return useCallback(() => {
    waiting.current = null;
    if (answer === "results" && land()) return;
    bar.current?.focusBar();
    if (answer === "pending") waiting.current = { anchor: document.activeElement, since: Date.now() };
  }, [answer, land, bar]);
}
