import { useCallback } from "react";
import { Pressable, View, type ViewStyle, type GestureResponderEvent } from "react-native";
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
  /** Disable the focus border (e.g. for cards that have their own styling) */
  noBorder?: boolean;
  /** Custom border radius for the focus ring (default: 12) */
  focusRadius?: number;
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
  noBorder = false,
  focusRadius = 12,
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

  const scaleStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [FocusConfig.scaleNormal, FocusConfig.scaleUp]);
    return {
      transform: [{ scale: s }],
    };
  });

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.5, 1]),
  }));

  return (
    <Pressable
      // @ts-ignore react-native-tvos extends Pressable
      style={style}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      testID={testID}
    >
      <Animated.View style={scaleStyle}>
        {children}
        {/* Absolute-positioned focus ring — does NOT affect layout */}
        {!noBorder && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: -3,
                left: -3,
                right: -3,
                bottom: -3,
                borderWidth: 3,
                borderColor: "#a78bfa",
                borderRadius: focusRadius,
                backgroundColor: "rgba(139, 92, 246, 0.12)",
              },
              ringStyle,
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}
