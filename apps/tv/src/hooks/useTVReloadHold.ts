import { useCallback, useEffect, useRef, useState } from "react";

/**
 * « Hold » de reload (remux tvOS) — extrait de PlayerScreen (budget 300 lignes).
 * Pendant un reload de reprise/seek, garde le LECTEUR en pause
 * (paused || reloadHold) SANS toucher l'état `paused` (intention utilisateur)
 * → la session sortante ne joue ni son ni image pendant le chargement.
 * Dé-pause automatique au onLoad de la nouvelle session (isLoading repasse
 * false). Remplace le `muted` (non fiable sur AVPlayer). Safety : levée
 * forcée à 10 s.
 */
export function useTVReloadHold(args: {
  isLoading: boolean;
  setIsLoading: (b: boolean) => void;
}) {
  const { isLoading, setIsLoading } = args;
  const [reloadHold, setReloadHold] = useState(false);
  // Miroir lu par les callbacks à deps [] (useTVRemuxStallRecovery).
  const reloadHoldRef = useRef(false);
  reloadHoldRef.current = reloadHold;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdForReload = useCallback(() => {
    setIsLoading(true);
    setReloadHold(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setReloadHold(false), 10000);
  }, [setIsLoading]);

  useEffect(() => {
    if (reloadHold && !isLoading) {
      setReloadHold(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [reloadHold, isLoading]);

  return { reloadHold, reloadHoldRef, holdForReload };
}
