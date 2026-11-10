/**
 * La SORTIE d'une feuille du hors ligne. Ses appelants la montent à la demande (`{open && …}`) :
 * démontée d'un coup, elle n'aurait jamais de sortie. La feuille garde donc sa propre ouverture ;
 * fermer la referme d'abord (200 ms, `Modal`), puis prévient l'appelant, qui la démonte.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { duration } from "../../theme/motion";

/** La sortie de `Modal`, et une image de marge pour ne pas couper sa dernière. */
const EXIT_MS = duration.sheetOut * 1000 + 20;

export function useSheetExit(onClose: () => void): { open: boolean; close: () => void } {
  const [open, setOpen] = useState(true);
  const timer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const close = useCallback(() => {
    if (timer.current !== null) return;
    setOpen(false);
    timer.current = window.setTimeout(() => onCloseRef.current(), EXIT_MS);
  }, []);

  return { open, close };
}
