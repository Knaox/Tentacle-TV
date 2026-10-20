import { createContext, useContext } from "react";

/** À partir de cette largeur (iPad), le texte de la carte prend la taille du grand écran. */
export const SWIPE_CARD_LARGE_FROM = 480;

/**
 * La carte est-elle « grande » ? Posé par la pile (`SwipeDeckView`) d'après la
 * largeur calculée, lu par le recto : un titre en taille téléphone paraît
 * minuscule sur une carte de 560 pt.
 */
export const SwipeCardLargeContext = createContext(false);

export function useSwipeCardLarge(): boolean {
  return useContext(SwipeCardLargeContext);
}
