import { useCallback, useEffect, useRef, useState } from "react";

/** Fenêtre de cumul des sauts consécutifs (= durée d'affichage du badge). Tant
 *  qu'on ré-appuie dans cette fenêtre et dans le MÊME sens, le badge cumule
 *  (+30 → +60 → +90 ; −10 → −20 → −30). */
const SKIP_BADGE_MS = 1500;

/**
 * Le badge « +30 s / −10 s » d'un saut instantané (appui ←/→, bouton de
 * saut) : juste le delta cumulé, façon Netflix. Un saut en sens opposé (ou
 * hors fenêtre) repart du delta seul. L'écran d'Apple TV le rend
 * (`SeekFlash`), celui d'Android TV aussi (`TVSkipBadge`).
 */
export function useSkipFlash() {
  const [skipFlash, setSkipFlash] = useState<{ delta: number; id: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumRef = useRef(0);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const flash = useCallback((delta: number) => {
    const sameDir = accumRef.current !== 0 && Math.sign(delta) === Math.sign(accumRef.current);
    accumRef.current = sameDir ? accumRef.current + delta : delta;
    setSkipFlash({ delta: accumRef.current, id: Date.now() });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { accumRef.current = 0; setSkipFlash(null); }, SKIP_BADGE_MS);
  }, []);

  return { skipFlash, flash };
}
