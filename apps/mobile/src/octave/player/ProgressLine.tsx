/**
 * Octave (mobile) — le filet de progression du mini-lecteur : la position suit le lecteur (quatre nouvelles par
 * seconde) et glisse entre deux en temps réel (Reanimated, `scaleX` seulement : jamais une largeur animée).
 */

import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { usePlayerPosition } from "./OctavePlayerContext";
import { useOctaveColors } from "../theme/octaveColors";

/** La fraction jouée (0 → 1), `0` sans durée connue. */
export function playedFraction(positionMs: number, durationMs: number | null): number {
  if (durationMs === null || durationMs <= 0) return 0;
  return Math.min(1, Math.max(0, positionMs / durationMs));
}

const STEP_MS = 260;

export const ProgressLine = memo(function ProgressLine({ width }: { width: number }) {
  const colors = useOctaveColors();
  const { positionMs, durationMs, running } = usePlayerPosition();
  const progress = useSharedValue(0);

  useEffect(() => {
    const now = playedFraction(positionMs, durationMs);
    // En lecture, on vise où sera le son à la prochaine nouvelle : la barre glisse au lieu de sauter.
    const ahead = running && durationMs ? Math.min(1, now + STEP_MS / durationMs) : now;
    progress.value = running ? withTiming(ahead, { duration: STEP_MS, easing: Easing.linear }) : withTiming(now, { duration: 120 });
  }, [positionMs, durationMs, running, progress]);

  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: (-width * (1 - progress.value)) / 2 }, { scaleX: progress.value }] }));

  return (
    <View style={[styles.track, { width, backgroundColor: colors.line }]} pointerEvents="none">
      <Animated.View style={[styles.fill, { width }, fill]}>
        <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: "hidden" },
  fill: { height: 2 },
});
