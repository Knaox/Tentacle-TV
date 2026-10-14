/**
 * Le badge « +10 s / −10 s » d'un saut, cumulé sur les appuis rapides dans le
 * MÊME sens (+10 → +20 → +30), façon TV/Netflix. Remis à zéro au changement
 * de sens ou après 1,5 s d'inactivité. Sorti de `useDesktopPlayerShortcuts`
 * pour servir aussi le lecteur des bandes-annonces — une seule copie.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { SkipFlash } from "../components/SkipBadge";

const BADGE_MS = 1500;

export function useSkipFlash(seekRelative: (delta: number) => void): { skipFlash: SkipFlash | null; skipBy: (delta: number) => void } {
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const accum = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const skipBy = useCallback((delta: number) => {
    seekRelative(delta);
    // mpv et l'élément vidéo coalescent déjà les sauts : on ne cumule que le badge.
    const sameDir = accum.current !== 0 && Math.sign(delta) === Math.sign(accum.current);
    accum.current = sameDir ? accum.current + delta : delta;
    setSkipFlash({ delta: accum.current, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { accum.current = 0; setSkipFlash(null); }, BADGE_MS);
  }, [seekRelative]);

  return { skipFlash, skipBy };
}
