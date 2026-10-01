import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { SoftGradient } from "../background/SoftGradient";
import { useFocusProgress } from "../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../motion/pressProgress";
import { useRecede, type RowPlace } from "../motion/useRowRecede";
import { colors, white } from "../theme/tokens";

/**
 * Le cadre d'une carte et son focus façon Apple TV — SANS contour :
 * - la carte grandit (× 1,08) et se soulève ;
 * - son ombre passe de l'élévation de repos à celle du soulèvement, par DEUX
 *   calques en fondu d'opacité (jamais une ombre animée — cf. `cards.css`) ;
 * - un reflet spéculaire discret glisse en travers de l'image ;
 * - une voisine a le focus, la carte recule un peu : `place` (sa place dans
 *   une rangée, lue sur le fil d'interface, sans rendu), ou `dimmed`.
 *
 * Le cadre ne fait que DESSINER : sur tvOS, un focalisable recouvert par un
 * frère qui dessine n'est plus proposé par la recherche géométrique du focus.
 * Une carte rend donc son cadre DANS sa cible focalisable (`FocusTarget
 * form="card"`), jamais en frère par-dessus elle — et la parallaxe au pouce
 * d'Apple TV, jouée sur la vue focalisée, l'emporte avec elle.
 */

/** L'agrandissement et le soulèvement du focus, pour une valeur de 0 à 1 —
 *  et l'appui (OK enfoncé), qui l'enfonce d'un cran. */
function cardLift(progress: number, press: number): [{ translateY: number }, { scale: number }] {
  "worklet";
  return [{ translateY: -4 * progress }, { scale: (1 + (TV_STAGE.focus.cardScale - 1) * progress) * pressScale(press) }];
}

/** Le point fixe de l'agrandissement : le haut dans une rangée, le centre dans une grille. */
function cardOrigin(origin: "top" | "center") {
  return { transformOrigin: origin === "top" ? "50% 0%" : "50% 50%" };
}

export interface CardFrameProps {
  width: number;
  height: number;
  radius: number;
  focused: boolean;
  /** Sa place dans une rangée (`useRowFocus`) : elle recule quand une
   *  voisine a le focus, sans que rien ne se redessine. */
  place?: RowPlace;
  /** Recule — pour une carte hors d'une rangée à valeur partagée. */
  dimmed?: boolean;
  /** L'appui sur la carte (OK enfoncé), tenu par sa cible (`FocusTarget`) —
   *  à défaut, celui de la cible qui CONTIENT le cadre (casting, extras,
   *  épisodes : le cadre y est rendu par la cible elle-même). */
  press?: SharedValue<number>;
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
  place,
  dimmed = false,
  press,
  origin = "top",
  children,
}: CardFrameProps) {
  const p = useFocusProgress(focused);
  const dim = useFocusProgress(dimmed && !focused, "recede");
  const recede = useRecede(place);
  const enclosing = usePressProgress();
  const pressed = press ?? enclosing;
  const lift = useAnimatedStyle(() => ({
    opacity: 1 - (1 - TV_STAGE.focus.recede) * (place ? recede.value : dim.value),
    transform: cardLift(p.value, pressed ? pressed.value : 0),
  }));
  const rest = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const raised = useAnimatedStyle(() => ({ opacity: p.value }));
  const sheen = useAnimatedStyle(() => ({ opacity: 0.9 * p.value }));
  const shape = { width, height, borderRadius: radius };
  return (
    <Animated.View style={[shape, cardOrigin(origin), lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadowRest, { borderRadius: radius }, rest]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadowRaised, { borderRadius: radius }, raised]} />
      <View style={[shape, styles.clip]}>
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheen]}>
          <SoftGradient
            width={width}
            height={height}
            colors={[white(0.26), white(0.06), white(0)]}
            locations={[0, 0.35, 0.6]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
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
