import { useCallback, useEffect, useRef, useState } from "react";
import { holdPresentedModal, whenNoModal, type PresentedModalHold } from "./modalGate";

/**
 * Une `Modal` qui ne se présente qu'une fois les autres retirées, et qui se
 * déclare au portier tant qu'elle est là (`modalGate`). `open` dit ce que
 * l'état demande ; `presented`, ce qui se présente vraiment ; `onShow` se
 * passe à la `Modal` (sans lui, elle ne retient le portier qu'un temps :
 * `holdPresentedModal`). Une demande retirée avant son tour ne se présente
 * jamais.
 */
export function useGatedModal(open: boolean, exitMs?: number): { presented: boolean; onShow: () => void } {
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
  const holdRef = useRef<PresentedModalHold | null>(null);
  const shownRef = useRef(false);
  useEffect(() => {
    if (!presented) return undefined;
    const hold = holdPresentedModal(exitMs);
    holdRef.current = hold;
    if (shownRef.current) hold.shown();
    return () => {
      holdRef.current = null;
      shownRef.current = false;
      hold.release();
    };
  }, [presented, exitMs]);
  const onShow = useCallback(() => {
    shownRef.current = true;
    holdRef.current?.shown();
  }, []);

  return { presented, onShow };
}
