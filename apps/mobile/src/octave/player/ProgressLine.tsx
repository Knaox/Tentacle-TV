/**
 * Octave (mobile) — le filet de progression du mini-lecteur (2 pt) : il avance PAR PAS, un point à la fois, à la
 * position que le lecteur donne (quatre fois par seconde) — jamais une animation continue (lot « bat » : un
 * `withTiming` relancé toutes les 250 ms faisait cloner l'arbre, relancer Yoga et monter à chaque image).
 * Rien du tout quand on ne le voit pas (app derrière, lecteur plein écran par-dessus) : il se remet à la bonne place
 * au retour. `scaleX` depuis la gauche : jamais une largeur, aucune mise en page.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { filledPoints } from "./positionTicks";
import { usePositionTick } from "./usePositionTick";
import { useShownBeneathPlayer } from "../layout/useOnScreen";
import { useOctaveColors } from "../theme/octaveColors";

export const ProgressLine = memo(function ProgressLine({ width }: { width: number }) {
  const colors = useOctaveColors();
  const shown = useShownBeneathPlayer();
  const filled = usePositionTick(shown, (position) => filledPoints(position, width));
  const scaleX = width > 0 ? filled / width : 0;

  return (
    <View style={[styles.track, { width, backgroundColor: colors.line }]} pointerEvents="none">
      <View style={[styles.fill, { width, transform: [{ scaleX }] }]}>
        <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: "hidden" },
  fill: { height: 2, transformOrigin: "left" },
});
