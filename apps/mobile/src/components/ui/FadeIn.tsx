import { useEffect, useRef, type ReactNode } from "react";
import { Animated, type ViewStyle } from "react-native";

interface Props {
  children: ReactNode;
  delay?: number;
  duration?: number;
  translateY?: number;
  style?: ViewStyle;
}

export function FadeIn({ children, delay = 0, duration = 350, translateY = 12, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translate, delay, duration]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: translate }] }, style]}>
      {children}
    </Animated.View>
  );
}
