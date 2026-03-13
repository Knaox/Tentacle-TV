import { memo, forwardRef, useCallback } from "react";
import { Pressable, View, type ViewStyle, type GestureResponderEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import type { FocusVariant } from "../../theme/focus";
import { FocusSpring, FocusScale, FocusGlow, FocusRowStyle, FocusButtonStyle } from "../../theme/focus";

interface FocusableProps {
  onPress?: (e?: GestureResponderEvent) => void;
  onLongPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
  testID?: string;
  /** @deprecated Use variant instead */
  noBorder?: boolean;
  /** Focus visual variant: card (glow+scale), button (scale+highlight), row (left bar+bg) */
  variant?: FocusVariant;
  /** Custom border radius for the glow halo (default: 12) */
  focusRadius?: number;
  /** Directional focus navigation — react-native-tvos nativeID refs */
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  accessibilityLabel?: string;
}

const SPRING_CONFIG = {
  damping: FocusSpring.damping,
  stiffness: FocusSpring.stiffness,
};

const GLOW_VARIANTS: Record<FocusVariant, number> = {
  card: 0.5,
  default: 0.3,
  button: 0,
  row: 0,
};

const HAS_SHADOW: Record<FocusVariant, boolean> = {
  card: true,
  default: true,
  button: true,
  row: false,
};

const HAS_GAP: Record<FocusVariant, boolean> = {
  card: true,
  default: true,
  button: false,
  row: false,
};

export const Focusable = memo(forwardRef<View, FocusableProps>(function Focusable({
  onPress,
  onLongPress,
  onFocus,
  onBlur,
  hasTVPreferredFocus = false,
  style,
  children,
  testID,
  variant = "default",
  focusRadius = 12,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  accessibilityLabel,
}: FocusableProps, ref) {
  const progress = useSharedValue(0);

  const handleFocus = useCallback(() => {
    progress.value = withSpring(1, SPRING_CONFIG);
    onFocus?.();
  }, [onFocus, progress]);

  const handleBlur = useCallback(() => {
    progress.value = withSpring(0, SPRING_CONFIG);
    onBlur?.();
  }, [onBlur, progress]);

  const scaleTarget = FocusScale[variant];
  const glowOpacity = GLOW_VARIANTS[variant];
  const hasShadow = HAS_SHADOW[variant];
  const hasGap = HAS_GAP[variant];
  const isRow = variant === "row";
  const isButton = variant === "button";

  const scaleStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [FocusScale.normal, scaleTarget]);
    return {
      transform: [{ scale: s }],
      zIndex: interpolate(progress.value, [0, 1], [0, 10]),
      ...(hasShadow ? {
        shadowOpacity: interpolate(progress.value, [0, 1], [0, FocusGlow.shadowOpacity]),
        elevation: interpolate(progress.value, [0, 1], [0, FocusGlow.elevation]),
      } : {}),
    };
  });

  const glowBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, glowOpacity]),
  }));

  // Row variant: animated background
  const rowBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["transparent", FocusRowStyle.bgColor],
    ),
  }));

  // Row variant: left bar opacity
  const rowBarStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Button variant: animated highlight overlay
  const buttonBgStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const RING_GAP = 4;

  return (
    <Pressable
      ref={ref}
      // @ts-ignore react-native-tvos extends Pressable
      style={style}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={hasTVPreferredFocus}
      testID={testID}
      nextFocusUp={nextFocusUp}
      nextFocusDown={nextFocusDown}
      nextFocusLeft={nextFocusLeft}
      nextFocusRight={nextFocusRight}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[
        scaleStyle,
        hasGap && { margin: -RING_GAP, padding: RING_GAP },
        hasShadow && {
          shadowColor: FocusGlow.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: FocusGlow.shadowRadius,
        },
      ]}>
        {/* Glow halo behind the card (card + default only) */}
        {glowOpacity > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[{
              position: "absolute",
              top: -6, left: -6, right: -6, bottom: -6,
              borderRadius: focusRadius + 6,
              backgroundColor: FocusGlow.color,
            }, glowBgStyle]}
          />
        )}

        {/* Button variant: highlight border overlay */}
        {isButton && (
          <Animated.View
            pointerEvents="none"
            style={[{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: focusRadius,
              backgroundColor: FocusButtonStyle.bgColor,
              borderWidth: FocusButtonStyle.borderWidth,
              borderColor: FocusButtonStyle.borderColor,
            }, buttonBgStyle]}
          />
        )}

        {/* Row variant: animated background + left bar */}
        {isRow && (
          <Animated.View
            pointerEvents="none"
            style={[{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: focusRadius,
            }, rowBgStyle]}
          >
            <Animated.View style={[{
              position: "absolute",
              left: 0, top: 6, bottom: 6,
              width: FocusRowStyle.barWidth,
              backgroundColor: FocusRowStyle.barColor,
              borderRadius: 2,
            }, rowBarStyle]} />
          </Animated.View>
        )}

        {children}
      </Animated.View>
    </Pressable>
  );
}));
