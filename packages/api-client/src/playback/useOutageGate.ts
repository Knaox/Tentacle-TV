import { useCallback, useEffect, useMemo, useRef } from "react";
import { getJellyfinHealth } from "../socket/jellyfinHealth";
import { createOutageGate } from "./outageGate";
import { useJellyfinOutage } from "./useJellyfinOutage";

export interface OutageGateHandle<F> {
  /** Remplace le report d'erreur du lecteur (même signature). */
  report: (failure: F) => void;
  /** Le lecteur attend des données (`true`) ou rejoue (`false`) — son évènement de mise en mémoire. */
  stalled: (on: boolean) => void;
}

/**
 * `outageGate.ts` branché sur un lecteur React : `report` remplace le report
 * d'erreur du lecteur, `stalled` reçoit ses attentes, et le retour de
 * Jellyfin ne rouvre le flux (`reopen`) que s'il le faut. Les rappels sont
 * lus au moment de servir : l'appelant peut les recréer à chaque rendu.
 */
export function useOutageGate<F>(
  reopen: () => void,
  diagnose: (failure: F) => void,
  started: () => boolean,
): OutageGateHandle<F> {
  const latest = useRef({ reopen, diagnose, started });
  latest.current = { reopen, diagnose, started };
  const gate = useMemo(() => createOutageGate<F>({
    state: () => getJellyfinHealth().state,
    started: () => latest.current.started(),
    reopen: () => latest.current.reopen(),
    diagnose: (failure) => latest.current.diagnose(failure),
    log: (line) => console.info(line),
  }), []);
  useEffect(() => () => gate.dispose(), [gate]);

  const { recoveries } = useJellyfinOutage();
  const seen = useRef(recoveries);
  useEffect(() => {
    if (recoveries === seen.current) return;
    seen.current = recoveries;
    gate.recovered();
  }, [recoveries, gate]);

  const report = useCallback((failure: F) => gate.report(failure), [gate]);
  const stalled = useCallback((on: boolean) => gate.stalled(on), [gate]);
  return useMemo(() => ({ report, stalled }), [report, stalled]);
}
