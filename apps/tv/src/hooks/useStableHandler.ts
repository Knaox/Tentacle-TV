import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Un gestionnaire d'identité STABLE qui appelle toujours la dernière version
 * de `handler` : pour un rappel que des listes mémoïsées reçoivent (cartes,
 * rangées) mais qui lit des données qui changent à chaque réponse — sans
 * lui, chaque réponse changeait le rappel, et toutes les cartes se
 * redessinaient pour rien. Jamais appelé pendant le rendu : seulement depuis
 * un geste (appui, focus).
 */
export function useStableHandler<Args extends unknown[], Result>(handler: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
