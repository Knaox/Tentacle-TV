import { useCallback, useEffect, type MutableRefObject } from "react";
import { useHoverEscape } from "../../hooks/useHoverGuard";

interface UseScrubListenersOptions {
  isScrubbing: MutableRefObject<boolean>;
  scrubPct: MutableRefObject<number>;
  thumbRef: MutableRefObject<HTMLDivElement | null>;
  barRef: MutableRefObject<HTMLDivElement | null>;
  duration: number;
  getPctFromEvent: (clientX: number) => number;
  setScrubbing: (v: boolean) => void;
  setHoverTime: (v: number | null) => void;
  setHoverX: (v: number) => void;
  onSeek: (seconds: number) => void;
  /** Une vignette de survol est-elle affichée ? Arme la garde de sortie. */
  hoverActive: boolean;
}

/**
 * Wire up the document-level mouse/touch listeners that drive the scrubbing
 * interaction (drag-to-seek on the seekbar), plus the escape hatch that turns
 * the hover preview off when the cursor leaves for good.
 */
export function useScrubListeners({
  isScrubbing, scrubPct, thumbRef, barRef, duration, getPctFromEvent,
  setScrubbing, setHoverTime, setHoverX, onSeek, hoverActive,
}: UseScrubListenersOptions): { endHover: () => void } {
  /**
   * Éteint la vignette. Pas pendant un scrub : la barre ne fait que six pixels
   * et le curseur en sort constamment quand on la fait glisser.
   */
  const endHover = useCallback(() => {
    if (!isScrubbing.current) setHoverTime(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Le `onMouseLeave` de la barre était sa SEULE porte de sortie, sur une cible
  // de six pixels de haut : qu'il soit manqué une fois — curseur sorti par le
  // bas de la fenêtre, passé sur un autre écran, application défocalisée — et
  // la vignette restait allumée. Constaté sur le lecteur de bureau, où la barre
  // est la même. Voir `useHoverEscape`.
  useHoverEscape(barRef, hoverActive, endHover);

  useEffect(() => {
    const resetUi = () => {
      if (thumbRef.current) thumbRef.current.style.opacity = "";
      if (barRef.current) barRef.current.style.height = "";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isScrubbing.current) return;
      e.preventDefault();
      const pct = getPctFromEvent(e.clientX);
      scrubPct.current = pct;
      setHoverTime(pct * duration);
      const barLeft = barRef.current?.getBoundingClientRect().left ?? 0;
      setHoverX(e.clientX - barLeft);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!isScrubbing.current) return;
      isScrubbing.current = false;
      setScrubbing(false);
      const pct = getPctFromEvent(e.clientX);
      onSeek(pct * duration);
      setHoverTime(null);
      resetUi();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!isScrubbing.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      const pct = getPctFromEvent(touch.clientX);
      scrubPct.current = pct;
      setHoverTime(pct * duration);
      const barLeft = barRef.current?.getBoundingClientRect().left ?? 0;
      setHoverX(touch.clientX - barLeft);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!isScrubbing.current) return;
      isScrubbing.current = false;
      setScrubbing(false);
      const touch = e.changedTouches[0];
      const pct = touch ? getPctFromEvent(touch.clientX) : scrubPct.current;
      onSeek(pct * duration);
      setHoverTime(null);
      resetUi();
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [
    isScrubbing, scrubPct, thumbRef, barRef, duration, getPctFromEvent,
    setScrubbing, setHoverTime, setHoverX, onSeek,
  ]);

  return { endHover };
}
