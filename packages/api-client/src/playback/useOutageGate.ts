import { useCallback, useEffect, useMemo, useRef } from "react";
import { getJellyfinHealth } from "../socket/jellyfinHealth";
import { createOutageGate } from "./outageGate";
import { playbackErrorsSuppressed, useJellyfinOutage } from "./useJellyfinOutage";

/**
 * `outageGate.ts` branché sur un lecteur React : `report` remplace le report
 * d'erreur du lecteur (même signature), et le retour de Jellyfin rouvre le
 * flux par `reopen`. Les rappels sont lus au moment de servir : l'appelant
 * peut les recréer à chaque rendu.
 */
export function useOutageGate<F>(reopen: () => void, diagnose: (failure: F) => void): (failure: F) => void {
  const latest = useRef({ reopen, diagnose });
  latest.current = { reopen, diagnose };
  const gate = useMemo(() => createOutageGate<F>({
    state: () => getJellyfinHealth().state,
    suppressed: playbackErrorsSuppressed,
    reopen: () => latest.current.reopen(),
    diagnose: (failure) => latest.current.diagnose(failure),
  }), []);

  const { recoveries } = useJellyfinOutage();
  const seen = useRef(recoveries);
  useEffect(() => {
    if (recoveries === seen.current) return;
    seen.current = recoveries;
    gate.recovered();
  }, [recoveries, gate]);

  return useCallback((failure: F) => gate.report(failure), [gate]);
}
