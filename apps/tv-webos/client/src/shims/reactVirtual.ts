import {
  useVirtualizer as useVirtualizerOriginal,
  useWindowVirtualizer as useWindowVirtualizerOriginal,
} from "@tanstack/react-virtual?original";

export * from "@tanstack/react-virtual?original";

/**
 * Les virtualiseurs de TanStack, sans rendu synchrone au défilement.
 *
 * Par défaut, chaque notification de défilement rend la grille par
 * `flushSync` : sur le web, c'est ce qui garde les rangées alignées sur une
 * molette ou un glissé continus. Sur un téléviseur, le défilement est une
 * écriture du moteur de focus — un pas net par appui —, et le rendu forcé
 * s'exécutait DANS l'évènement de défilement : toute la bibliothèque, barre
 * de filtres comprise, rendue d'un bloc à chaque rangée franchie. Mesuré sur
 * la C3, touche maintenue : ~50 ms par appui, le quart du temps de script.
 *
 * Rendu à la cadence ordinaire de React, juste après l'évènement, rien ne
 * manque à l'écran : les trois rangées de rab du virtualiseur sont déjà
 * montées au moment où le pas les révèle.
 */
export const useVirtualizer: typeof useVirtualizerOriginal = (options) =>
  useVirtualizerOriginal({ useFlushSync: false, ...options });

export const useWindowVirtualizer: typeof useWindowVirtualizerOriginal = (options) =>
  useWindowVirtualizerOriginal({ useFlushSync: false, ...options });
