import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sampleHealth } from "./pluginApi";
import { onHealthSample, pollDelay, startRestart, type RestartPhase } from "./restartMachine";

export interface RestartTracker {
  phase: RestartPhase;
  /** Un geste vient de programmer un redémarrage : le suivre jusqu'au retour du serveur. */
  begin: (bootId: string | undefined, label: string | null) => void;
  dismiss: () => void;
}

/** Sans modules en échec, l'annonce du retour s'efface d'elle-même. */
const BACK_NOTICE_MS = 8000;

/**
 * Le suivi d'un redémarrage du serveur : sonde `/api/health` jusqu'à ce
 * qu'un autre processus réponde (`restartMachine`), puis appelle `onBack` —
 * c'est là que la page relit tout ce que le redémarrage a pu changer.
 *
 * Une seule boucle de sonde à la fois, liée au début de l'attente : les
 * échantillons font avancer l'état sans relancer la boucle.
 */
export function useRestartTracker(onBack: () => void): RestartTracker {
  const [phase, setPhase] = useState<RestartPhase>({ kind: "idle" });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const begin = useCallback((bootId: string | undefined, label: string | null) => {
    // Deux gestes pendant le même redémarrage n'en font qu'un à suivre.
    setPhase((current) => (current.kind === "waiting" ? current : startRestart(bootId, label, Date.now())));
  }, []);

  const dismiss = useCallback(() => setPhase({ kind: "idle" }), []);

  const waitingSince = phase.kind === "waiting" ? phase.startedAt : null;
  useEffect(() => {
    if (waitingSince === null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      const sample = await sampleHealth();
      if (cancelled) return;
      const next = onHealthSample(phaseRef.current, sample, Date.now());
      phaseRef.current = next;
      setPhase(next);
      if (next.kind === "waiting") timer = setTimeout(poll, pollDelay(next, Date.now()));
    };
    timer = setTimeout(poll, pollDelay(phaseRef.current, Date.now()));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [waitingSince]);

  const backAt = phase.kind === "back" ? phase.at : null;
  const backClean = phase.kind === "back" && phase.failures.length === 0;
  useEffect(() => {
    if (backAt === null) return;
    onBackRef.current();
    if (!backClean) return;
    const timer = setTimeout(() => setPhase((current) => (current.kind === "back" && current.at === backAt ? { kind: "idle" } : current)), BACK_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [backAt, backClean]);

  return useMemo(() => ({ phase, begin, dismiss }), [phase, begin, dismiss]);
}
