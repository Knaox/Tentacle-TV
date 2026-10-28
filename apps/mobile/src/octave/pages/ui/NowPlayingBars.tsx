/**
 * Octave mobile — les trois barres du titre EN COURS : elles dansent pendant la
 * lecture, se figent en pause, et restent immobiles avec le mouvement réduit.
 * Rien que des transformations (le fil d'interface les joue seul).
 */

import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { usePagesWantsPlay } from "../env/pagesPlayer";

const DELAYS = [0, 180, 90];

function Bar({ color, delay, live }: { color: string; delay: number; live: boolean }) {
  const scale = useSharedValue(0.4);
  useEffect(() => {
    if (!live) {
      cancelAnimation(scale);
      scale.value = withTiming(0.4, { duration: 160 });
      return;
    }
    scale.value = withDelay(delay, withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(scale);
  }, [delay, live, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: scale.value }] }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export const NowPlayingBars = memo(function NowPlayingBars({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const live = usePagesWantsPlay() && !reduced;
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {DELAYS.map((d, i) => (
        <Bar key={i} color={color} delay={d} live={live} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", height: 14, gap: 2 },
  bar: { width: 3, height: 14, borderRadius: 1.5, transformOrigin: "bottom" },
});
