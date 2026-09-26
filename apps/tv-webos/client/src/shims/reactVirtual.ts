import { useEffect, useState } from "react";
import {
  useVirtualizer as useVirtualizerOriginal,
  useWindowVirtualizer as useWindowVirtualizerOriginal,
  type VirtualItem,
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

/**
 * Les hauteurs MESURÉES des rangées, par écran, d'un montage au suivant.
 *
 * Revenir d'une fiche remonte la grille, et un virtualiseur neuf ne connaît
 * plus que son estimation — trop courte sur la dalle, où la légende des cartes
 * est plus haute que sur le web : 340,6 px par rangée pour 367 réels. La
 * position rendue par `useScrollMemory` tombait donc sur d'autres rangées que
 * celles qu'on avait quittées ; puis, en mesurant les rangées au-dessus de la
 * vue, TanStack « compensait » en décalant le défilement. Mesuré depuis le fond
 * de la bibliothèque : +105 px à chaque aller-retour, la carte focalisée
 * remontant d'autant à l'écran.
 *
 * `initialMeasurementsCache` est l'option prévue pour ce cas. On lui rend le
 * cache ENTIER, tel que TanStack le tient, et non une sélection : il en attend
 * une liste contiguë, rangée par index. Il n'en retient que les tailles et
 * recalcule les positions avec la marge courante. Les rangées jamais montées y
 * gardent l'estimation d'alors — la même, la dalle ne changeant pas de
 * largeur — et sont mesurées comme les autres quand elles paraissent.
 */
const measurementsByScreen = new Map<string, VirtualItem[]>();

/** Assez pour les bibliothèques et les collections ; le plus ancien part. */
const KEPT_SCREENS = 12;

export const useWindowVirtualizer: typeof useWindowVirtualizerOriginal = (options) => {
  // L'écran qui porte la grille, lu au premier rendu : l'adresse le désigne
  // déjà, le routeur l'ayant changée avant de rendre.
  const [screen] = useState(() => window.location.pathname);
  const virtualizer = useWindowVirtualizerOriginal({
    useFlushSync: false,
    initialMeasurementsCache: measurementsByScreen.get(screen),
    ...options,
  });

  useEffect(
    () => () => {
      measurementsByScreen.delete(screen);
      measurementsByScreen.set(screen, virtualizer.measurementsCache.slice());
      if (measurementsByScreen.size > KEPT_SCREENS) {
        const oldest = measurementsByScreen.keys().next();
        if (!oldest.done) measurementsByScreen.delete(oldest.value);
      }
    },
    [virtualizer, screen],
  );

  return virtualizer;
};
