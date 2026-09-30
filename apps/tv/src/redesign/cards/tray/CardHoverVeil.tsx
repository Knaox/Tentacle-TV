import { memo } from "react";
import { StyleSheet } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { scrim } from "../../theme/tokens";
import { TRAY_REVEAL_MS } from "./useCardHover";

/**
 * Le voile du survol (`--card-hover-veil` du bureau) : l'image reste lisible
 * en haut, le bas s'assombrit assez (0,9) pour porter étoiles et plateau SANS
 * flou — il n'y aurait rien de visible à flouter. Posé sous les marqueurs :
 * la barre de progression reste lisible par-dessus, comme au bureau.
 */
export const CardHoverVeil = memo(function CardHoverVeil({ shown }: { shown: boolean }) {
  const p = useFocusProgress(shown, TRAY_REVEAL_MS);
  const fade = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
      <LinearGradient colors={VEIL} locations={STOPS} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
});

const VEIL = [scrim(0.1), scrim(0.3), scrim(0.9)];
const STOPS = [0, 0.38, 1];
