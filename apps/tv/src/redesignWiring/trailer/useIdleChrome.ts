import { useCallback, useEffect, useRef, useState } from "react";

/** Le délai sans geste au bout duquel le chrome s'estompe. */
const IDLE_MS = 3000;

/**
 * Le chrome d'une lecture plein écran : allumé, puis estompé après trois
 * secondes sans geste ; `wake` le rallume et relance l'attente. Rien ne
 * s'estompe hors lecture (chargement, indisponible).
 */
export function useIdleChrome(playing: boolean): { dimmed: boolean; wake: () => void } {
  const [dimmed, setDimmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDimmed(true), IDLE_MS);
  }, []);

  useEffect(() => {
    setDimmed(false);
    if (playing) arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, arm]);

  const wake = useCallback(() => {
    setDimmed(false);
    if (playingRef.current) arm();
  }, [arm]);

  return { dimmed, wake };
}
