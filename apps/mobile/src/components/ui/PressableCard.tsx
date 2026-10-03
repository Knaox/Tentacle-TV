import { type ReactNode } from "react";
import { Pressable, type ViewStyle, type AccessibilityRole, type AccessibilityState } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { haptic as playHaptic } from "@/utils/haptics";

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
 * Wrapper pressable avec animation scale spring (Reanimated 3). Effet "card
 * tap" Netflix : scale 0.97 sur press, retour spring natural. Le retour
 * haptique attend l'action validée (`utils/hapticCues.ts`) : le doigt qui se
 * pose pour faire défiler une rangée ne fait que contracter la carte.
 */
export function PressableCard({
  children, onPress, onLongPress, style, scaleValue = 0.97,
  accessibilityRole, accessibilityLabel, accessibilityState, haptic = true,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(scaleValue, { damping: 18, stiffness: 280, mass: 0.7 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.7 });
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
      <Animated.View style={[animStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
