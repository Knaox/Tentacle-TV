import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, PanResponder, useWindowDimensions, type GestureResponderEvent } from "react-native";
import { useTranslation } from "react-i18next";

const DOUBLE_TAP_MS = 300;
const SWIPE_DOWN_THRESHOLD = 100;
const DOUBLE_TAP_INDICATOR_MS = 700;

interface Props {
  currentTime: number;
  overlayVisible: boolean;
  onSeek: (seconds: number) => void;
  onToggleOverlay: () => void;
  onSwipeDown: () => void;
}

export function PlayerGestures({ currentTime, overlayVisible, onSeek, onToggleOverlay, onSwipeDown }: Props) {
  const { t } = useTranslation("player");
  const { width: SCREEN_W, height: screenH } = useWindowDimensions();
  const indicatorSize = Math.min(72, Math.round(screenH * 0.09));
  const [doubleTapSide, setDoubleTapSide] = useState<"left" | "right" | null>(null);
  const lastTapRef = useRef<{ time: number; side: "left" | "right" | "center" }>({ time: 0, side: "center" });
  const singleTapTimer = useRef<ReturnType<typeof setTimeout>>();
  const doubleTapFadeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => {
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    if (doubleTapFadeTimer.current) clearTimeout(doubleTapFadeTimer.current);
  }, []);

  const handleTap = useCallback((e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX;
    const now = Date.now();
    const side: "left" | "right" | "center" =
      x < SCREEN_W * 0.35 ? "left" : x > SCREEN_W * 0.65 ? "right" : "center";

    const elapsed = now - lastTapRef.current.time;
    const sameSide = side === lastTapRef.current.side;

    if (elapsed < DOUBLE_TAP_MS && sameSide && side !== "center") {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      onSeek(side === "left" ? currentTime - 10 : currentTime + 30);
      setDoubleTapSide(side);
      if (doubleTapFadeTimer.current) clearTimeout(doubleTapFadeTimer.current);
      doubleTapFadeTimer.current = setTimeout(() => setDoubleTapSide(null), DOUBLE_TAP_INDICATOR_MS);
      lastTapRef.current = { time: 0, side: "center" };
    } else {
      lastTapRef.current = { time: now, side };
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = setTimeout(onToggleOverlay, DOUBLE_TAP_MS);
    }
  }, [currentTime, onSeek, onToggleOverlay]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 20,
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > SWIPE_DOWN_THRESHOLD && Math.abs(gs.dx) < gs.dy) {
        onSwipeDown();
      }
    },
  }), [onSwipeDown]);

  // Only render tap zone when overlay is hidden — otherwise overlay handles its own taps
  return (
    <>
      {!overlayVisible && (
        <Pressable
          onPress={handleTap}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          {...panResponder.panHandlers}
        />
      )}

      {/* Double-tap skip indicator */}
      {doubleTapSide && (
        <View pointerEvents="none" style={{
          position: "absolute", top: "38%",
          [doubleTapSide === "left" ? "left" : "right"]: SCREEN_W * 0.08,
          backgroundColor: "rgba(0,0,0,0.5)", borderRadius: indicatorSize / 2,
          width: indicatorSize, height: indicatorSize, justifyContent: "center", alignItems: "center",
        }}>
          <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
            {doubleTapSide === "left" ? "-10" : "+30"}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{t("secondsShort")}</Text>
        </View>
      )}
    </>
  );
}
