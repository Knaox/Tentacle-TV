import { memo } from "react";
import { StyleSheet, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { scrim, white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";

/**
 * La fiche pendant son chargement : la même mise en page, en formes
 * vides — le logo, la ligne de métadonnées, les actions, le synopsis, puis le
 * titre de la section suivante, au pied. IMMOBILE : aucune pulsation (une boucle
 * infinie ne se dessine jamais pour rien), le fond vivant suffit à dire que
 * l'écran respire.
 */

const bar = (width: number, height = 26, radius = height / 2) => ({ width, height, borderRadius: radius });

export const DetailSkeleton = memo(function DetailSkeleton() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[scrim(0.55), scrim(0.1), scrim(0)]}
        locations={[0, 0.45, 0.8]}
        start={{ x: 0, y: 0.4 }}
        end={{ x: 1, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <View style={[styles.block, bar(560, 150, 28)]} />
        <View style={styles.row}>
          <View style={[styles.block, bar(90)]} />
          <View style={[styles.block, bar(70)]} />
          <View style={[styles.block, bar(120)]} />
          <View style={[styles.block, bar(210)]} />
          <View style={[styles.block, bar(80)]} />
        </View>
        <View style={styles.row}>
          <View style={[styles.block, bar(310, 68)]} />
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={[styles.block, bar(68, 68)]} />
          ))}
        </View>
        <View style={styles.lines}>
          <View style={[styles.block, bar(880, 24)]} />
          <View style={[styles.block, bar(900, 24)]} />
          <View style={[styles.block, bar(840, 24)]} />
          <View style={[styles.block, bar(520, 24)]} />
        </View>
      </View>
      <View style={[styles.block, styles.peek, bar(360, 36, 12)]} />
    </View>
  );
});

const styles = StyleSheet.create({
  header: { position: "absolute", left: DETAIL_LEFT, bottom: 150, gap: 30 },
  row: { flexDirection: "row", alignItems: "center", gap: 18 },
  lines: { gap: 16, marginTop: 30 },
  block: { backgroundColor: white(0.08) },
  peek: { position: "absolute", left: DETAIL_LEFT, top: 1020 },
});
