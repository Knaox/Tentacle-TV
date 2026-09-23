import { useCallback, useEffect, useRef, useState } from "react";

/**
 * « Hold » de reload — extrait de PlayerScreen (budget 300 lignes).
 * Pendant un reload de piste/qualité, garde le LECTEUR en pause
 * (paused || reloadHold) SANS toucher l'état `paused` (intention utilisateur)
 * → la session sortante ne joue ni son ni image pendant le chargement.
 * Dé-pause automatique au onLoad de la nouvelle session (isLoading repasse
 * false). Remplace le `muted` (non fiable sur AVPlayer). Safety : levée
 * forcée à 35 s — l'ouverture d'une session PrismCore a un budget de 30 s
 * (cf. PrismSessionRegistry), et une levée prématurée faisait « bliper »
 * l'audio de la session sortante.
 */
export function useTVReloadHold(args: {
  isLoading: boolean;
  setIsLoading: (b: boolean) => void;
}) {
  const { isLoading, setIsLoading } = args;
  const [reloadHold, setReloadHold] = useState(false);
  // Miroir lu par les callbacks à deps [].
  const reloadHoldRef = useRef(false);
  reloadHoldRef.current = reloadHold;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdForReload = useCallback(() => {
    setIsLoading(true);
    setReloadHold(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setReloadHold(false), 35000);
  }, [setIsLoading]);

  useEffect(() => {
    if (reloadHold && !isLoading) {
      setReloadHold(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [reloadHold, isLoading]);

  return { reloadHold, reloadHoldRef, holdForReload };
}
