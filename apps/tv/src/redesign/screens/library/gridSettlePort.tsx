import { createContext, useContext } from "react";

/**
 * Le PORT de la grille POSÉE (`gridMotion` : ni focus ni défilement depuis
 * `GRID_PREVIEW_SETTLE_MS`) : la vue le sait — elle seule voit défiler sa
 * liste —, l'intégration en a besoin pour rendre la colonne après un
 * défilement accéléré (tv-core `gridColumnHold`, la Siri Remote n'annonçant
 * pas toujours la fin d'une flèche tenue). Sans fournisseur (le banc) : rien.
 */
const GridSettleContext = createContext<(() => void) | null>(null);

export const GridSettleProvider = GridSettleContext.Provider;

/** Ce que la grille appelle quand elle se pose, ou `null`. */
export function useGridSettlePort(): (() => void) | null {
  return useContext(GridSettleContext);
}
