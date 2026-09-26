import { useCallback, useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { isSwipeDown, SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS, tapSide, type TapSide } from "../playerMetrics";
import { SkipIndicator } from "./SkipIndicator";

const DOUBLE_TAP_MS = 300;
const INDICATOR_MS = 700;

interface Props {
  overlayVisible: boolean;
  onSkip: (delta: number) => void;
  onToggleOverlay: () => void;
  onSwipeDown: () => void;
}

/**
 * Les gestes sur la vidéo quand l'habillage est masqué — `PlayerGestures` de
 * l'app : un tap l'affiche (après 300 ms, le temps d'écarter un double-tap) ;
 * un double-tap sur le tiers gauche recule de 10 s, sur le tiers droit avance
 * de 30 s, avec l'indicateur rond ; un balayage vers le bas quitte le lecteur.
 * Habillage visible, la zone se retire : c'est lui qui prend les taps.
 */
export function PlayerGestures({ overlayVisible, onSkip, onToggleOverlay, onSwipeDown }: Props) {
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const lastTap = useRef<{ time: number; side: TapSide }>({ time: 0, side: "center" });
  const singleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => () => {
    clearTimeout(singleTimer.current);
    clearTimeout(fadeTimer.current);
  }, []);

  const onTap = useCallback((e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const current = tapSide(e.clientX - rect.left, rect.width);
    const now = Date.now();
    const previous = lastTap.current;
    if (now - previous.time < DOUBLE_TAP_MS && current === previous.side && current !== "center") {
      clearTimeout(singleTimer.current);
      onSkip(current === "left" ? -SKIP_BACK_SECONDS : SKIP_FORWARD_SECONDS);
      setSide(current);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setSide(null), INDICATOR_MS);
      lastTap.current = { time: 0, side: "center" };
      return;
    }
    lastTap.current = { time: now, side: current };
    clearTimeout(singleTimer.current);
    singleTimer.current = setTimeout(onToggleOverlay, DOUBLE_TAP_MS);
  }, [onSkip, onToggleOverlay]);

  const onTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  }, []);

  const onTouchEnd = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    if (isSwipeDown(t.clientX - start.x, t.clientY - start.y)) {
      clearTimeout(singleTimer.current);
      onSwipeDown();
    }
  }, [onSwipeDown]);

  return (
    <>
      {!overlayVisible && (
        <div
          className="pointer-events-auto absolute inset-0 [touch-action:manipulation] [-webkit-tap-highlight-color:transparent]"
          onClick={onTap}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        />
      )}
      <SkipIndicator side={side} />
    </>
  );
}
