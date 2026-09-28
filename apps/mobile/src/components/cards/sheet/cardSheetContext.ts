import { createContext, useContext } from "react";
import type { CardSheetTarget } from "./cardSheetTarget";

/** Ouvre la feuille d'appui long sur une carte. */
export type OpenCardSheet = (target: CardSheetTarget) => void;

/**
 * Où mènent « Lire » et « Plus d'infos ». Par défaut, on empile (`/watch`,
 * `/media`) ; la recherche, qui est une MODALE, passe par sa propre
 * navigation (`useSearchNavigation`) : elle se referme d'abord.
 */
export interface CardSheetNavigation {
  play: (itemId: string) => void;
  open: (itemId: string) => void;
}

/**
 * L'ouvreur de la feuille le plus proche — `null` hors de toute portée : la
 * carte n'a alors pas d'appui long, plutôt qu'un appui long qui ne fait rien.
 */
export const CardSheetContext = createContext<OpenCardSheet | null>(null);

export function useCardSheetOpener(): OpenCardSheet | null {
  return useContext(CardSheetContext);
}
