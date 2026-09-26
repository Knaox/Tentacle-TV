import { useCallback, useEffect, useRef, type RefObject } from "react";
import { SEARCH_SUBMIT_WAIT_MS, type SearchSubmitAnswer } from "@tentacle-tv/tv-core";
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
 * descendre : c'est le seul moyen que LG documente — `PalmSystem.keyboardHide`
 * existe, sans documentation ni garantie.
 *
 * Où va le focus : la décision est commune aux trois téléviseurs
 * (`searchSubmitAnswer`, tv-core). Ici, au premier résultat de la colonne ;
 * sinon à la barre, qui montre la saisie et d'où « droite » mène aux
 * résultats. Une réponse encore en route y emmène le focus à son arrivée si
 * l'on est resté sur la barre.
 */
export function useSubmitToResults(
  answer: SearchSubmitAnswer,
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
    if (answer !== "results" || Date.now() - pending.since > SEARCH_SUBMIT_WAIT_MS) return;
    if (document.activeElement === pending.anchor) land();
  }, [answer, land]);

  return useCallback(() => {
    waiting.current = null;
    if (answer === "results" && land()) return;
    bar.current?.focusBar();
    if (answer === "pending") waiting.current = { anchor: document.activeElement, since: Date.now() };
  }, [answer, land, bar]);
}
