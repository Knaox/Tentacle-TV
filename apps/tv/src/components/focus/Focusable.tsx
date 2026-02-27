import { useCallback } from "react";
import { Pressable, type ViewStyle, type GestureResponderEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { FocusConfig } from "../../theme/colors";

interface FocusableProps {
  onPress?: (e?: GestureResponderEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
  testID?: string;
}

const SPRING_CONFIG = {
  damping: FocusConfig.springDamping,
  stiffness: FocusConfig.springStiffness,
};

export function Focusable({
  onPress,
  onFocus,
  onBlur,
  hasTVPreferredFocus = false,
  style,
  children,
  testID,
}: FocusableProps) {
  const progress = useSharedValue(0);

  const handleFocus = useCallback(() => {
    progress.value = withSpring(1, SPRING_CONFIG);
    onFocus?.();
  }, [onFocus, progress]);

  const handleBlur = useCallback(() => {
    progress.value = withSpring(0, SPRING_CONFIG);
    onBlur?.();
  }, [onBlur, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [FocusConfig.scaleNormal, FocusConfig.scaleUp]);
    return {
      transform: [{ scale: s }],
      elevation: interpolate(progress.value, [0, 1], [0, 8]),
    };
  });

  return (
    <Pressable
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // @ts-ignore react-native-tvos extends Pressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      testID={testID}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
