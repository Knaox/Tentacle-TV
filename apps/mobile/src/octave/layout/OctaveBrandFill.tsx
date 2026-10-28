/**
 * Octave (mobile) — le FOND de marque de l'action principale : le dégradé
 * violet → rose du bouton de lecture du lecteur (`brandFill`), posé sous le
 * contenu d'un bouton, et un voile à l'appui. Un seul endroit : un bouton
 * « Lecture » ou l'appel d'une feuille ne prend jamais une couleur à lui.
 */

import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useOctaveColors } from "../theme/octaveColors";

export const OctaveBrandFill = memo(function OctaveBrandFill({ radius, pressed = false }: { radius: number; pressed?: boolean }) {
  const colors = useOctaveColors();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}>
      <LinearGradient colors={colors.brandFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {pressed ? <View style={[StyleSheet.absoluteFill, styles.press]} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Le voile d'appui : un noir léger, la teinte reste la même.
  press: { backgroundColor: "rgba(0,0,0,0.16)" },
});
