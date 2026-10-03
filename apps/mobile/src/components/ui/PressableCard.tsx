import { useState, type ReactNode } from "react";
import { Animated, Pressable, type ViewStyle, type AccessibilityRole, type AccessibilityState } from "react-native";
import { haptic as playHaptic } from "@/utils/haptics";

/**
 * Le ressort de la carte : mêmes paramètres physiques que l'ancien `withSpring`
 * de Reanimated, joué par le pilote natif d'Animated. Une carte n'enregistre
 * plus de worklet ni de style animé sur le fil UI en se montant — une grille
 * qui défile en monte des centaines — et le ressort ne coûte qu'à l'appui.
 */
const SPRING = { damping: 18, stiffness: 280, mass: 0.7, useNativeDriver: true } as const;

interface Props {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  scaleValue?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  /** L'état lu par les lecteurs d'écran (sélection, case cochée…). */
  accessibilityState?: AccessibilityState;
  /** Retour haptique à l'appui confirmé et à l'appui long (par défaut). */
  haptic?: boolean;
}

/**
 * Wrapper pressable avec animation scale spring. Effet "card
 * tap" Netflix : scale 0.97 sur press, retour spring natural. Le retour
 * haptique attend l'action validée (`utils/hapticCues.ts`) : le doigt qui se
 * pose pour faire défiler une rangée ne fait que contracter la carte.
 */
export function PressableCard({
  children, onPress, onLongPress, style, scaleValue = 0.97,
  accessibilityRole, accessibilityLabel, accessibilityState, haptic = true,
}: Props) {
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: scaleValue, ...SPRING }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
  };

  // Absent, l'appui long le reste : un Pressable sans `onLongPress` laisse un
  // appui tenu finir en `onPress`.
  const handlePress = onPress && (() => {
    if (haptic) playHaptic("tap");
    onPress();
  });
  const handleLongPress = onLongPress && (() => {
    if (haptic) playHaptic("longPress");
    onLongPress();
  });

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}
