import { useEffect, type ReactNode } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from "react-native-reanimated";
import { motion } from "@/theme";

/**
 * La cascade de texte du hero desktop (fadeUp + stagger) : chaque groupe
 * monte de huit points en fondu, décalé de 40 ms par rang. Rejouée à chaque
 * slide qui devient actif ; inerte (opacité pleine) en mouvement réduit.
 * Transform/opacity uniquement — jamais de layout.
 */
export function CascadeGroup({ order, active, children }: { order: number; active: boolean; children: ReactNode }) {
  const reduced = motion.isReducedMotion();
  const progress = useSharedValue(reduced || active ? 1 : 0);
  useEffect(() => {
    if (reduced) { progress.value = 1; return; }
    if (active) {
      progress.value = 0;
      progress.value = withDelay(order * 40, withTiming(1, { duration: 220 }));
    }
  }, [active, order, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 8 }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
