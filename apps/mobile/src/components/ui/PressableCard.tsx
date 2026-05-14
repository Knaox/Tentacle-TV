import { type ReactNode } from "react";
import { Pressable, type ViewStyle, type AccessibilityRole } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try {
  Haptics = require("expo-haptics");
} catch { /* ignore */ }

interface Props {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  scaleValue?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  haptic?: boolean;
}

/**
 * Wrapper pressable avec animation scale spring (Reanimated 3). Effet "card
 * tap" Netflix : scale 0.97 sur press, retour spring natural.
 */
export function PressableCard({
  children, onPress, onLongPress, style, scaleValue = 0.97,
  accessibilityRole, accessibilityLabel, haptic = true,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    if (haptic) Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(scaleValue, { damping: 18, stiffness: 280, mass: 0.7 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 280, mass: 0.7 });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[animStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}
