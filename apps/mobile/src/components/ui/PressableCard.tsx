import { useRef, type ReactNode } from "react";
import { Pressable, Animated, type ViewStyle, type AccessibilityRole } from "react-native";

// expo-haptics may not be available in all Expo Go builds
let Haptics: { impactAsync: (style: any) => void; ImpactFeedbackStyle: any } | null = null;
try {
  Haptics = require("expo-haptics");
} catch {
  // native module not available
}

interface Props {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  scaleValue?: number;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
}

export function PressableCard({ children, onPress, onLongPress, style, scaleValue = 0.97, accessibilityRole, accessibilityLabel }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scale, {
      toValue: scaleValue,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} onPressIn={handlePressIn} onPressOut={handlePressOut} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
