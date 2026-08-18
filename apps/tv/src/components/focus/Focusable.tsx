import { memo, forwardRef, useCallback, useRef } from "react";
import { Pressable, View, type ViewStyle, type GestureResponderEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import type { FocusVariant } from "../../theme/focus";
import { FocusTiming, FocusScale, FocusGlow, FocusRowStyle, FocusButtonStyle, FocusBorder } from "../../theme/focus";
import { Easings } from "../../theme/motion";
import { TV_CARD_FOCUS } from "@tentacle-tv/theme";
// Seuil du maintien, partagé avec la LG : le geste doit être le même partout.
import { SEUIL_APPUI_LONG_MS } from "@tentacle-tv/tv-core";

interface FocusableProps {
  onPress?: (e?: GestureResponderEvent) => void;
  onLongPress?: () => void;
  /** Key-down sur ce bouton (sélection enfoncée) — pour les boutons « maintien ». */
  onPressIn?: () => void;
  /** Key-up sur ce bouton (sélection relâchée) — fin du maintien. */
  onPressOut?: () => void;
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
  /** Scale au focus — override du variant (ex: 1.03 en grille dense pour
   *  éviter que la carte focusée déborde sur ses voisines). */
  scaleOverride?: number;
  /** Directional focus navigation — react-native-tvos nativeID refs */
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  accessibilityLabel?: string;
  /** Anti « clic fantôme » TV : ne déclenche onPress QUE si un onPressIn (key-down)
   *  a eu lieu sur ce bouton. Bloque le press parasite du relâchement d'un hold OK
   *  qui a révélé l'OSD (le key-down était sur un autre élément → pas de onPressIn). */
  phantomPressGuard?: boolean;
}

/** Durée et courbe du focus, reprises de la référence : 180 ms, sortie franche.
 *  Le ressort d'avant faisait dépasser la carte puis revenir, ce qui se lit
 *  comme une hésitation quand on parcourt une rangée à la flèche. */
const TIMING_FOCUS = { duration: FocusTiming.duration, easing: Easings.out };

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
  onPressIn,
  onPressOut,
  onFocus,
  onBlur,
  hasTVPreferredFocus = false,
  style,
  children,
  testID,
  variant = "default",
  focusRadius = 12,
  scaleOverride,
  nextFocusUp,
  nextFocusDown,
  nextFocusLeft,
  nextFocusRight,
  accessibilityLabel,
  phantomPressGuard = false,
}: FocusableProps, ref) {
  const progress = useSharedValue(0);
  // Anti clic-fantôme : un vrai press émet onPressIn (key-down) PUIS onPress
  // (key-up). Le press parasite d'un hold (key-down ailleurs) n'a pas d'onPressIn.
  const pressInRef = useRef(false);

  const handleFocus = useCallback(() => {
    progress.value = withTiming(1, TIMING_FOCUS);
    onFocus?.();
  }, [onFocus, progress]);

  const handleBlur = useCallback(() => {
    progress.value = withTiming(0, TIMING_FOCUS);
    pressInRef.current = false; // un pressIn non suivi de press ne doit pas persister
    onBlur?.();
  }, [onBlur, progress]);

  const handlePressIn = useCallback(() => { pressInRef.current = true; onPressIn?.(); }, [onPressIn]);
  const handlePressOut = useCallback(() => { onPressOut?.(); }, [onPressOut]);
  const handlePress = useCallback((e?: GestureResponderEvent) => {
    if (phantomPressGuard && !pressInRef.current) return; // clic fantôme → ignorer
    pressInRef.current = false;
    onPress?.(e);
  }, [phantomPressGuard, onPress]);

  const scaleTarget = scaleOverride ?? FocusScale[variant];
  const glowOpacity = GLOW_VARIANTS[variant];
  const hasShadow = HAS_SHADOW[variant];
  const hasGap = HAS_GAP[variant];
  const isRow = variant === "row";
  const isButton = variant === "button";
  const isCard = variant === "card";

  const scaleStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [FocusScale.normal, scaleTarget]);
    return {
      transform: [{ scale: s }],
      // Une affiche qui grandit par son centre empiète sur la rangée du dessus.
      // En grandissant par le bas, elle pousse vers le haut, dans la marge que
      // la rangée réserve déjà pour l'anneau.
      transformOrigin: TV_CARD_FOCUS.origine,
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

  // Button variant: animated highlight overlay
  const buttonBgStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  // Card variant: crisp violet border that fades in on focus
  const cardBorderStyle = useAnimatedStyle(() => ({
    opacity: progress.value * FocusBorder.opacity,
  }));

  const RING_GAP = 4;

  return (
    <Pressable
      ref={ref}
      style={style}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={SEUIL_APPUI_LONG_MS}
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

        {/* Variante « ligne » : le fond se remplit, sans barre — cf. FocusRowStyle. */}
        {isRow && (
          <Animated.View
            pointerEvents="none"
            style={[{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: focusRadius,
            }, rowBgStyle]}
          />
        )}

        {children}

        {/* Card variant: crisp violet border drawn ON TOP of children. */}
        {isCard && (
          <Animated.View
            pointerEvents="none"
            style={[{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: focusRadius,
              borderWidth: FocusBorder.width,
              borderColor: FocusBorder.color,
            }, cardBorderStyle]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}));
