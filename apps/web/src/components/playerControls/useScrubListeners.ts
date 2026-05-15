import { useEffect, type MutableRefObject } from "react";

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
}

/**
 * Wire up the document-level mouse/touch listeners that drive the scrubbing
 * interaction (drag-to-seek on the seekbar).
 */
export function useScrubListeners({
  isScrubbing, scrubPct, thumbRef, barRef, duration, getPctFromEvent,
  setScrubbing, setHoverTime, setHoverX, onSeek,
}: UseScrubListenersOptions): void {
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
}
