import { type ReactNode } from "react";
import Animated, {
  FadeInDown, FadeIn as RNFadeIn, type AnimatedStyle,
} from "react-native-reanimated";
import type { ViewStyle, StyleProp } from "react-native";

interface Props {
  children: ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: StyleProp<ViewStyle | AnimatedStyle<ViewStyle>>;
}

/**
 * Entrance animation Reanimated 3 — fade + translateY upward. Plus fluide
 * que l'ancienne version Animated core, et respecte automatiquement
 * `prefers-reduced-motion` (Reanimated layout animations).
 */
export function FadeIn({ children, delay = 0, duration = 320, translateY = 14, style }: Props) {
  // FadeInDown supports duration / delay / damping config; pour translateY > 0,
  // on l'oriente vers up (les valeurs négatives translateY ne sont pas l'API native).
  const animation = translateY > 0
    ? FadeInDown.duration(duration).delay(delay).springify().damping(18).withInitialValues({
      originY: translateY,
    } as { originY: number })
    : RNFadeIn.duration(duration).delay(delay);

  return (
    <Animated.View entering={animation} style={style}>
      {children}
    </Animated.View>
  );
}
