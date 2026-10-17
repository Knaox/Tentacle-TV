import { createContext, useContext } from "react";

/**
 * Le PORT des rangées qui reviennent au début — l'accueil, « Pour vous »
 * (la règle : tv-core `focus/rowRewind.ts`). Une rangée (`MediaRow`) s'y
 * déclare avec sa remise au début, la page y dit où sont ses rangées et
 * qu'elle défile ; l'intégration décide quand remettre une rangée au début et
 * le fait — sans animation, sans un rendu : la rangée est hors de l'écran.
 *
 * Aucun fournisseur (la recherche, une fiche, le banc UI) : rien n'est
 * déclaré, aucune rangée ne bouge. Les épisodes, les saisons et la
 * distribution d'une fiche n'en relèvent pas : on y cherche un élément
 * précis, garder sa place compte.
 */
export interface RowRewindPort {
  /** Une rangée se déclare avec sa remise au début ; rend son retrait. */
  register(rowKey: string, toStart: () => void): () => void;
  /** Son cadre dans la page (repère du contenu qui défile). */
  layout(rowKey: string, top: number, height: number): void;
  /** La page défile : son décalage et sa hauteur. */
  scroll(offset: number, height: number): void;
}

const RowRewindContext = createContext<RowRewindPort | null>(null);

export const RowRewindProvider = RowRewindContext.Provider;

/** Le port de l'écran, ou null : la rangée garde sa place quoi qu'il arrive. */
export function useRowRewindPort(): RowRewindPort | null {
  return useContext(RowRewindContext);
}
