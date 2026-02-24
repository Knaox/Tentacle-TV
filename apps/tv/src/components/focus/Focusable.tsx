import { useRef, useState, useCallback } from "react";
import { Pressable, Animated, type ViewStyle, type GestureResponderEvent } from "react-native";

interface FocusableProps {
  onPress?: (e?: GestureResponderEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  focusedBorderColor?: string;
  children: React.ReactNode;
  testID?: string;
}

export function Focusable({
  onPress,
  onFocus,
  onBlur,
  hasTVPreferredFocus = false,
  style,
  focusedBorderColor = "#8b5cf6",
  children,
  testID,
}: FocusableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.spring(scale, {
      toValue: 1.08,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
    onFocus?.();
  }, [onFocus, scale]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
    onBlur?.();
  }, [onBlur, scale]);

  return (
    <Pressable
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // @ts-expect-error react-native-tvos extends Pressable
      hasTVPreferredFocus={hasTVPreferredFocus}
      testID={testID}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale }] },
          focused && {
            borderWidth: 3,
            borderColor: focusedBorderColor,
            borderRadius: 12,
            shadowColor: focusedBorderColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 12,
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
