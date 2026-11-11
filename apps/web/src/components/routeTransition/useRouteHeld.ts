import { useSyncExternalStore } from "react";
import { isRouteHeld, subscribeRouteHold } from "./routeHold";

const never = (): boolean => false;

/**
 * Une navigation attend-elle (`routeHold.ts`) ? — pour ce qui, sur la page QUITTÉE, ne doit plus
 * rien COMMENCER : elle reste à l'écran et vivante le temps que la suivante se prépare, mais
 * celui qui vient de cliquer s'en va. L'aperçu d'une carte, par exemple, ne s'ouvre plus sous
 * le curseur pendant qu'on attend la fiche de cette même carte.
 *
 * À n'appeler que là où il y a PEU d'abonnés (la session de la carte survolée, pas chaque
 * carte) : chaque abonné est rendu au début et à la fin de chaque tenue.
 */
export function useRouteHeld(): boolean {
  return useSyncExternalStore(subscribeRouteHold, isRouteHeld, never);
}
