import { useEffect, useRef } from "react";
import { useUpdateLocked } from "./updateLock";

/**
 * Pendant une mise à jour, la lecture est en PAUSE — et y reste.
 *
 * Monté par les deux lecteurs (`usePlayerStillWatching`). Un effet, pas un geste unique : une
 * touche média du système, une télécommande Jellyfin ou la reprise d'une séance de groupe
 * peuvent relancer la lecture sous la pop-up ; tant que le verrou tient, toute reprise est
 * remise en pause. La pause passe par la commande du lecteur lui-même.
 */
export function useUpdateLockPause(playing: boolean, pause: () => void): void {
  const locked = useUpdateLocked();
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (locked && playing) pauseRef.current();
  }, [locked, playing]);
}
