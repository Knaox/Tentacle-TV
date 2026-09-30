import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { colors, scrim } from "../../theme/tokens";

/**
 * Un contenu rendu DEUX fois — clair sur le verre, sombre sur le blanc du
 * focus — et fondu de l'un à l'autre : seule l'opacité s'anime (pas de
 * couleur animée, qui repeindrait à chaque image). La copie sombre se pose
 * exactement sur la claire : mêmes styles, seule la couleur change.
 */

export type Tone = "light" | "dark";

export const TONES: Record<Tone, { primary: string; secondary: string; tertiary: string; accent: string }> = {
  light: { primary: colors.text, secondary: colors.textSecondary, tertiary: colors.textTertiary, accent: colors.accentLight },
  dark: { primary: colors.ctaFg, secondary: scrim(0.72), tertiary: scrim(0.56), accent: colors.accentDeep },
};

export function DualTone({
  progress,
  style,
  contentStyle,
  children,
}: {
  progress: SharedValue<number>;
  /** La place du bloc (flex, largeur). */
  style?: StyleProp<ViewStyle>;
  /** La mise en page de CHAQUE copie (écarts, alignements). */
  contentStyle?: StyleProp<ViewStyle>;
  children: (tone: Tone) => ReactNode;
}) {
  const light = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const dark = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <View style={style}>
      <Animated.View style={[contentStyle, light]}>{children("light")}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, contentStyle, dark]}>{children("dark")}</Animated.View>
    </View>
  );
}
