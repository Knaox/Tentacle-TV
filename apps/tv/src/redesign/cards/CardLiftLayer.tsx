import { memo, type ReactNode } from "react";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { cardLift, cardOrigin } from "./CardFrame";

/**
 * Un calque qui ÉPOUSE l'image d'une carte agrandie — même point fixe, même
 * agrandissement, même soulèvement, sur la MÊME valeur de focus que son
 * `CardFrame` (`progress`) — sans en être l'enfant : l'étage du plateau.
 *
 * Transparent et `box-none` : il ne dessine rien lui-même, seuls ses enfants
 * (étoiles, capsule, bulle) le font. La carte focalisable se pose au-dessus de
 * lui, et s'arrête au-dessus des boutons du plateau (`trayReach`).
 */
export const CardLiftLayer = memo(function CardLiftLayer({
  width,
  height,
  origin = "top",
  progress,
  children,
}: {
  width: number;
  height: number;
  origin?: "top" | "center";
  progress: SharedValue<number>;
  children: ReactNode;
}) {
  const lift = useAnimatedStyle(() => ({ transform: cardLift(progress.value) }));
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[{ position: "absolute", left: 0, top: 0, width, height }, cardOrigin(origin), lift]}
    >
      {children}
    </Animated.View>
  );
});
