import { memo, forwardRef, useCallback, useRef, useState } from "react";
import { Platform, Pressable, View, type ViewStyle, type GestureResponderEvent } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
} from "react-native-reanimated";
import type { FocusVariant } from "../../theme/focus";
import { FocusTiming, FocusScale, FocusGlow, FocusRowStyle, FocusButtonStyle, FocusPlayerButtonStyle, FocusBorder } from "../../theme/focus";
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

/**
 * L'ombre s'anime-t-elle sans rien coûter ?
 *
 * Sur Apple, oui : `shadowOpacity` est une propriété de `CALayer`, animée par
 * le compositeur. Sur Android, `shadowOpacity` ne dessine rien du tout (c'est
 * `elevation` qui fait l'ombre) et `elevation` fait retrier tout le groupe de
 * vues à chaque changement. On ne l'anime donc pas là-bas.
 */
const OMBRE_ANIMABLE = Platform.OS === "ios";

const GLOW_VARIANTS: Record<FocusVariant, number> = {
  card: 0.5,
  default: 0.3,
  button: 0,
  playerButton: 0,
  row: 0,
};

const HAS_SHADOW: Record<FocusVariant, boolean> = {
  card: true,
  default: true,
  button: true,
  playerButton: false,
  row: false,
};

const HAS_GAP: Record<FocusVariant, boolean> = {
  card: true,
  default: true,
  button: false,
  playerButton: false,
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
  /**
   * Le rang de peinture, en ÉTAT et non dans le worklet — c'est ce qui a rendu
   * la navigation fluide sur Android.
   *
   * `zIndex` et `elevation` ne sont pas des propriétés de `RenderNode` comme
   * `transform` : ce sont des propriétés de GROUPE. Les changer fait retrier au
   * conteneur l'ordre de dessin de tous ses enfants, et l'invalide entièrement.
   * Dans le worklet, cela se produisait à chaque image, pendant les 180 ms de
   * chaque changement de focus, sur une rangée où une centaine de cellules sont
   * montées — et pour deux `Focusable` à la fois, celui qui prend le focus et
   * celui qui le perd. Mesuré au `dumpsys gfxinfo` : 23 % d'images en retard,
   * dont 212 sur 217 imputées à « slow issue draw commands ».
   *
   * En état, le rang ne change plus que DEUX fois par déplacement. L'effet
   * visuel est identique — l'échelle, elle, reste dans le worklet, où elle ne
   * coûte rien.
   *
   * tvOS n'était pas concerné : `zPosition` et `shadowOpacity` s'y animent sur
   * la couche, sans rien retrier. C'est toute l'asymétrie entre les deux
   * téléviseurs.
   */
  const [aLeFocus, setALeFocus] = useState(false);
  // Anti clic-fantôme : un vrai press émet onPressIn (key-down) PUIS onPress
  // (key-up). Le press parasite d'un hold (key-down ailleurs) n'a pas d'onPressIn.
  const pressInRef = useRef(false);

  const handleFocus = useCallback(() => {
    progress.value = withTiming(1, TIMING_FOCUS);
    setALeFocus(true);
    onFocus?.();
  }, [onFocus, progress]);

  const handleBlur = useCallback(() => {
    progress.value = withTiming(0, TIMING_FOCUS);
    setALeFocus(false);
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
  const isButton = variant === "button" || variant === "playerButton";
  const isCard = variant === "card";
  // L'OSD remplit d'un blanc translucide, sans bordure — l'anneau suffit.
  const buttonFill = variant === "playerButton" ? FocusPlayerButtonStyle : FocusButtonStyle;
  const buttonBorderWidth = variant === "playerButton" ? 0 : FocusButtonStyle.borderWidth;

  // Le worklet ne porte plus QUE l'échelle — et, sur Apple, l'opacité de
  // l'ombre, qui y est une propriété de couche. Voir `aLeFocus`.
  const scaleStyle = useAnimatedStyle(() => {
    const s = interpolate(progress.value, [0, 1], [FocusScale.normal, scaleTarget]);
    return {
      transform: [{ scale: s }],
      ...(hasShadow && OMBRE_ANIMABLE
        ? { shadowOpacity: interpolate(progress.value, [0, 1], [0, FocusGlow.shadowOpacity]) }
        : {}),
    };
  });

  /** Rang de peinture et relief, posés d'un coup au focus puis retirés au flou.
   *  `elevation` ne sert qu'à Android — `shadowOpacity` et consorts n'y
   *  dessinent rien — et c'est là qu'il coûte cher à animer. */
  const rang: ViewStyle | false = aLeFocus && {
    zIndex: 10,
    ...(hasShadow && !OMBRE_ANIMABLE ? { elevation: FocusGlow.elevation } : {}),
  };

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
        // Hors du style ANIMÉ : Reanimated ne sait pas évaluer `transformOrigin`
        // dans un worklet et lève à chaque image. Il n'a de toute façon pas à
        // s'animer — seule l'échelle bouge, l'origine est fixe.
        //
        // Une affiche qui grandit par son centre empiète sur la rangée du
        // dessus, où le regard n'a rien à faire ; en grandissant par le bas,
        // elle pousse vers le haut, dans la marge que la rangée réserve déjà
        // pour l'anneau.
        { transformOrigin: TV_CARD_FOCUS.origine },
        scaleStyle,
        rang,
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
              backgroundColor: buttonFill.bgColor,
              borderWidth: buttonBorderWidth,
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
