import { useEffect, useRef, useState } from "react";

/** Au-delà de ce pas, la position a réellement avancé : l'image est là. */
const STARTED_DELTA_S = 0.25;

/**
 * La lecture a-t-elle COMMENCÉ ? La règle du bureau (`useDesktopLoadingOverlay`) :
 * le média chargé ne suffit pas — le moteur annonce son chargement avant la
 * première image, et une reprise saute encore après. On attend que la
 * position avance d'un quart de seconde au-delà de la première vue. Verrou :
 * une renégociation en pleine lecture (piste, palier) ne rouvre pas l'écran
 * de chargement.
 */
export function usePlaybackStarted(videoReady: boolean, currentTime: number): boolean {
  const [started, setStarted] = useState(false);
  const firstRef = useRef<number | null>(null);
  useEffect(() => {
    if (started || !videoReady) return;
    if (firstRef.current === null) {
      firstRef.current = currentTime;
      return;
    }
    if (Math.abs(currentTime - firstRef.current) > STARTED_DELTA_S) setStarted(true);
  }, [videoReady, currentTime, started]);
  return started;
}
