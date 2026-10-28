/**
 * Octave (mobile) — l'appui des cartes et des boutons du mode : un léger
 * enfoncement à ressort (0,97), rendu au relâcher ; jamais de changement de
 * mise en page. Mouvement réduit respecté (le système le coupe).
 */

import { memo, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const PRESS = { damping: 18, stiffness: 420, mass: 0.6, reduceMotion: ReduceMotion.System } as const;

interface Props extends Omit<PressableProps, "style" | "children"> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Échelle à l'appui (0,97 par défaut ; 0,94 pour un petit bouton rond). */
  pressedScale?: number;
}

export const PressableScale = memo(function PressableScale({ children, style, pressedScale = 0.97, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        scale.value = withSpring(pressedScale, PRESS);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, PRESS);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
});
