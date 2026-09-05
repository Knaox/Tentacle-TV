import { useCallback } from "react";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { motion } from "@/theme";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: Record<string, unknown> } | null = null;
try {
  Haptics = require("expo-haptics");
} catch { /* optionnel (Expo Go) */ }

/** Ressort maison (PressableCard) pour la pression, plus vif au relâcher. */
const PRESS_SPRING = { damping: 18, stiffness: 280, mass: 0.7 };
const RELEASE_SPRING = { damping: 12, stiffness: 320, mass: 0.7 };
const PRESS_SCALE = 0.85;
const PRESS_OPACITY = 0.7;

interface Options {
  haptic?: boolean;
  /** Contraction sous le doigt : 0,85 pour une icône seule, ~0,97 pour une rangée. */
  scale?: number;
}

/**
 * Le retour d'appui d'un onglet, façon Instagram : l'icône se contracte sous
 * le doigt puis revient avec un léger dépassement, une haptique légère
 * ponctue la pression. Transform/opacité seulement, sur le fil UI. En
 * mouvement réduit : l'opacité seule, sans ressort.
 */
export function useTabPressFeedback({ haptic = true, scale: pressScale = PRESS_SCALE }: Options = {}) {
  const scale = useSharedValue(1);
  const dim = useSharedValue(1);

  const bounceStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (haptic) Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dim.value = withTiming(PRESS_OPACITY, { duration: motion.respectReducedMotion(80) });
    if (!motion.isReducedMotion()) scale.value = withSpring(pressScale, PRESS_SPRING);
  }, [haptic, pressScale, dim, scale]);

  const onPressOut = useCallback(() => {
    dim.value = withTiming(1, { duration: motion.respectReducedMotion(120) });
    if (!motion.isReducedMotion()) scale.value = withSpring(1, RELEASE_SPRING);
  }, [dim, scale]);

  return { bounceStyle, onPressIn, onPressOut };
}
