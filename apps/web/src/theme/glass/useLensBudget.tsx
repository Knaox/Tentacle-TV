/**
 * La lentille d'un verre est-elle ACCORDÉE ? Deux conditions (lot lg5) :
 *  - la PORTÉE (`GlassLensScope`) : un groupe de verres posé sur un dessous qui
 *    bouge sans cesse peut renoncer à la lentille — les petits ronds de la
 *    bannière de l'accueil (décision de Damien du 23/10) ;
 *  - le BUDGET de la page (`LENS_BUDGET`, `lensBudgetStore.ts`) : au-delà de
 *    huit lentilles visibles, les moins prioritaires restent du givre (« C »).
 * Refusée, la surface garde son givre, sa teinte et son ombre : seule la
 * réfraction du bord et sa lumière partent (le rendu de `data-lg-render="lens"`
 * sans carte, celui d'avant la première mesure).
 */

import { createContext, useContext, useId, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";

import { lensGranted, lensRankOf, registerLens, subscribeLensBudget } from "./lensBudgetStore";

const LensAllowed = createContext(true);

/**
 * Les verres de ce sous-arbre renoncent (`lens={false}`) à la lentille, ou la
 * retrouvent (`lens`, défaut). À poser autour d'un GROUPE posé sur un dessous
 * animé, jamais d'une page entière.
 */
export function GlassLensScope({ lens, children }: { lens: boolean; children: ReactNode }) {
  return <LensAllowed.Provider value={lens}>{children}</LensAllowed.Provider>;
}

/** La portée permet-elle la lentille ? (`GlassLensScope` le plus proche ; permise par défaut.) */
export function useLensAllowed(): boolean {
  return useContext(LensAllowed);
}

/** La lentille de ce verre : voulue, permise par la portée, et dans le budget de la page. */
export function useLensBudget(element: HTMLElement | null, wanted: boolean, surface: boolean): boolean {
  const allowed = useLensAllowed();
  const id = useId();
  const enrolled = wanted && allowed && element !== null;
  useLayoutEffect(() => {
    if (!enrolled || element === null) return undefined;
    return registerLens(id, element, lensRankOf(element, surface));
  }, [enrolled, element, id, surface]);
  const granted = useSyncExternalStore(subscribeLensBudget, () => lensGranted(id), () => false);
  return enrolled && granted;
}
