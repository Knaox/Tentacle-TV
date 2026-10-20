import { useEffect, useState } from "react";
import { retainModal, whenNoModal } from "./modalGate";

/**
 * Une `Modal` qui ne se présente qu'une fois les autres retirées, et qui se
 * déclare au portier tant qu'elle est là (`modalGate`). `open` dit ce que
 * l'état demande ; le retour, ce qui se présente vraiment. Une demande
 * retirée avant son tour ne se présente jamais.
 */
export function useGatedModal(open: boolean, exitMs?: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return undefined;
    }
    let live = true;
    whenNoModal(() => { if (live) setShown(true); });
    return () => { live = false; };
  }, [open]);

  const presented = open && shown;
  useEffect(() => {
    if (!presented) return undefined;
    return retainModal(exitMs);
  }, [presented, exitMs]);

  return presented;
}
