import type { ReactElement } from "react";
import type { BenchData } from "../data/benchData";

/**
 * Une scène du catalogue : UN écran (ou une brique) dans UN état.
 *
 * `focusKeys` liste les éléments que le banc sait figer dans l'état focalisé :
 * la planche d'une scène les passe tous en revue, sans télécommande. La même
 * clé est celle que la vue reçoit (`focusKey`) et lit par `useFocusVisual`.
 */
export interface BenchScene {
  /** `groupe/état`, en minuscules sans accents — stable : les planches et la
   *  ligne de commande s'y réfèrent. */
  id: string;
  /** Le groupe du catalogue (un écran, ou « Briques »). */
  group: string;
  /** L'état, tel qu'on le lit dans le menu. */
  label: string;
  focusKeys?: string[];
  /** Délai avant « prêt » (animations d'entrée, images) ; 900 ms par défaut. */
  settleMs?: number;
  /** Les images à précharger avant de dire « prêt ». */
  images?: (data: BenchData) => string[];
  render: (data: BenchData) => ReactElement;
}
