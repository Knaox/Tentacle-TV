import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AUTO_HIDE_MS, FADE_MS } from "./playerMetrics";

/**
 * L'auto-masquage de l'habillage de l'app (`MobilePlayerOverlay`) : en lecture,
 * 4 s après le dernier geste, un fondu d'opacité de 300 ms, puis l'habillage se
 * DÉMONTE. En pause, il reste. L'affichage est immédiat (pas de fondu
 * d'entrée), et un tap sur le fond le retire tout de suite — comme dans l'app.
 *
 * Un glissé de la barre ou un menu ouvert suspend le minuteur (`clearHide`) ;
 * sa fermeture le réarme (`resetHideTimer`).
 */
export function usePlayerChrome({ visible, setVisible, paused }: {
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;
  paused: boolean;
}): {
  opacity: number;
  resetHideTimer: () => void;
  clearHide: () => void;
  toggle: () => void;
} {
  const [fading, setFading] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearHide = useCallback(() => {
    clearTimeout(hideTimer.current);
  }, []);

  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (paused) return;
    hideTimer.current = setTimeout(() => {
      setFading(true);
      fadeTimer.current = setTimeout(() => setVisible(false), FADE_MS);
    }, AUTO_HIDE_MS);
  }, [paused, setVisible]);

  useEffect(() => {
    if (visible) {
      clearTimeout(fadeTimer.current);
      setFading(false);
      resetHideTimer();
    }
    return () => clearTimeout(hideTimer.current);
  }, [visible, resetHideTimer]);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const toggle = useCallback(() => setVisible((v) => !v), [setVisible]);

  return { opacity: fading ? 0 : 1, resetHideTimer, clearHide, toggle };
}
