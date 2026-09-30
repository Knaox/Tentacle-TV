import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useFocusProgress } from "../focus/useFocusProgress";
import { colors, white } from "../theme/tokens";

/**
 * Le cadre d'une carte et son focus façon Apple TV — SANS contour :
 * - la carte grandit (× 1,08) et se soulève ;
 * - son ombre passe de l'élévation de repos à celle du soulèvement, par DEUX
 *   calques en fondu d'opacité (jamais une ombre animée — cf. `cards.css`) ;
 * - un reflet spéculaire discret glisse en travers de l'image ;
 * - `dimmed` : une voisine a le focus, la carte recule un peu.
 */

export interface CardFrameProps {
  width: number;
  height: number;
  radius: number;
  focused: boolean;
  dimmed?: boolean;
  /** Point fixe de l'agrandissement : le haut pour une rangée (la légende
   *  dessous ne bouge pas), le centre dans une grille. */
  origin?: "top" | "center";
  children: ReactNode;
}

export const CardFrame = memo(function CardFrame({
  width,
  height,
  radius,
  focused,
  dimmed = false,
  origin = "top",
  children,
}: CardFrameProps) {
  const p = useFocusProgress(focused);
  const d = useFocusProgress(dimmed && !focused, 300);
  const lift = useAnimatedStyle(() => ({
    opacity: 1 - (1 - TV_STAGE.focus.recede) * d.value,
    transform: [{ translateY: -4 * p.value }, { scale: 1 + (TV_STAGE.focus.cardScale - 1) * p.value }],
  }));
  const rest = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const raised = useAnimatedStyle(() => ({ opacity: p.value }));
  const sheen = useAnimatedStyle(() => ({ opacity: 0.9 * p.value }));
  const shape = { width, height, borderRadius: radius };
  return (
    <Animated.View style={[shape, { transformOrigin: origin === "top" ? "50% 0%" : "50% 50%" }, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadowRest, { borderRadius: radius }, rest]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadowRaised, { borderRadius: radius }, raised]} />
      <View style={[shape, styles.clip]}>
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheen]}>
          <LinearGradient
            colors={[white(0.26), white(0.06), white(0)]}
            locations={[0, 0.35, 0.6]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius }, styles.hairline]} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: "hidden", backgroundColor: colors.surface2 },
  hairline: { borderWidth: 1, borderColor: white(0.12) },
  shadowRest: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  shadowRaised: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 28 },
    shadowOpacity: 0.65,
    shadowRadius: 30,
  },
});
