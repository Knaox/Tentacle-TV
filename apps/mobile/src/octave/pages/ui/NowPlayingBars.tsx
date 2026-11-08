/**
 * Octave mobile — les trois barres du titre EN COURS : elles dansent pendant la
 * lecture, se posent en pause, et restent immobiles avec le mouvement réduit.
 *
 * Batterie (lot « bat ») : elles ne bougent QUE si on les voit (`useShownBeneathPlayer` : page regardée, lecteur
 * plein écran fermé, app au premier plan) ; sinon, posées, sans aucune animation. Et quand elles dansent, c'est
 * l'`Animated` NATIF de React Native : UNE animation aller-retour rejouée sans fin par le natif, qui met la vue à
 * jour directement (`synchronouslyUpdateViewOnUIThread`) — ni JS, ni clone de l'arbre, ni Yoga à chaque image,
 * ce que Reanimated 3 sur Fabric faisait (page d'album en lecture : 15,9 % d'un cœur contre 2,2 % en pause).
 */

import { memo, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { barsMotion, type BarsMotion } from "../../layout/onScreen";
import { useShownBeneathPlayer } from "../../layout/useOnScreen";
import { usePagesWantsPlay } from "../env/pagesPlayer";

const DELAYS = [0, 180, 90];
/** Une montée et une descente de 420 ms chacune. */
const CYCLE_MS = 840;
const REST_MS = 160;
const REST_SCALE = 0.4;

const quad = Easing.inOut(Easing.quad);
/** Monte puis redescend sur UNE animation (0 → 1 → 0) : la boucle se rejoue côté natif, sans repasser par le JS. */
const upAndDown = (t: number): number => quad(t < 0.5 ? t * 2 : (1 - t) * 2);

function Bar({ color, delay, motion }: { color: string; delay: number; motion: BarsMotion }) {
  // 0 : posée ; 1 : en haut.
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (motion === "still") {
      lift.stopAnimation();
      lift.setValue(0);
      return;
    }
    const animation =
      motion === "rest"
        ? Animated.timing(lift, { toValue: 0, duration: REST_MS, useNativeDriver: true })
        : Animated.loop(Animated.timing(lift, { toValue: 1, duration: CYCLE_MS, delay, easing: upAndDown, useNativeDriver: true }));
    if (motion === "dance") lift.setValue(0);
    animation.start();
    return () => animation.stop();
  }, [delay, motion, lift]);
  // Un seul nœud d'interpolation par barre : en recréer un à chaque rendu rebrancherait la vue côté natif.
  const scaleY = useMemo(() => lift.interpolate({ inputRange: [0, 1], outputRange: [REST_SCALE, 1] }), [lift]);
  return <Animated.View style={[styles.bar, { backgroundColor: color, transform: [{ scaleY }] }]} />;
}

export const NowPlayingBars = memo(function NowPlayingBars({ color }: { color: string }) {
  const reducedMotion = useReducedMotion();
  const playing = usePagesWantsPlay();
  const shown = useShownBeneathPlayer();
  const motion = barsMotion({ shown, playing, reducedMotion });
  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {DELAYS.map((d, i) => (
        <Bar key={i} color={color} delay={d} motion={motion} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-end", height: 14, gap: 2 },
  bar: { width: 3, height: 14, borderRadius: 1.5, transformOrigin: "bottom" },
});
