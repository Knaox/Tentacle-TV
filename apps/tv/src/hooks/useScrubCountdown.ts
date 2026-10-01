import { useEffect, useMemo, useRef, useState } from "react";
import { createScrubCountdown, type ScrubCountdown, type ScrubCountdownState } from "./scrubCountdown";

/**
 * Le décompte du défilement (`scrubCountdown.ts`) en état React : le
 * contrôleur le pilote, l'écran le lit. Un rendu par seconde affichée, aucun
 * hors décompte. `onResume` : la reprise est échue (lue au moment même).
 */
export function useScrubCountdown(onResume: () => void): {
  countdown: ScrubCountdown;
  countdownState: ScrubCountdownState | null;
} {
  const [countdownState, setCountdownState] = useState<ScrubCountdownState | null>(null);
  const resumeRef = useRef(onResume);
  resumeRef.current = onResume;
  const countdown = useMemo(
    () => createScrubCountdown({ onChange: setCountdownState, onResume: () => resumeRef.current() }),
    [],
  );
  useEffect(() => () => countdown.destroy(), [countdown]);
  return { countdown, countdownState };
}
