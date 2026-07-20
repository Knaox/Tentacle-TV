import { useCallback } from "react";
import { probeNow } from "../offline/connectivityStore";
import { useConnectivity } from "../offline/useConnectivity";

/**
 * Adaptateur de compatibilité au-dessus du store de connectivité
 * (`offline/connectivityStore.ts`), qui est désormais l'UNIQUE sondeur :
 * hystérésis, sondes périodiques hors ligne, réveils sur les signaux
 * navigateur et écoute des erreurs TanStack (via `ConnectivityBinding`).
 *
 * Conserve l'API historique `{ isReachable, retry }` consommée par
 * `OfflineBanner` (overlay bloquant, comportement WEB). « checking » est
 * traité comme joignable — même optimisme qu'avant la première sonde.
 */
export function useServerReachable() {
  const { state } = useConnectivity();
  const retry = useCallback(() => probeNow(true), []);
  return {
    isReachable: state === "online" || state === "checking",
    retry,
  };
}
