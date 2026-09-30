import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { white } from "../../theme/tokens";
import { GRID_GAP, GRID_ROW_GAP, posterWidth } from "./PosterGrid";

/**
 * Le chargement d'une grille : des affiches fantômes à la géométrie EXACTE
 * de la vraie grille (même largeur, même légende), pour que rien ne saute à
 * l'arrivée des titres. Statique : aucune lueur qui boucle — une animation
 * infinie coûte à chaque image pour ne rien dire de plus.
 */

export const GridSkeleton = memo(function GridSkeleton({ columns = 6, rows = 2 }: { columns?: 5 | 6; rows?: number }) {
  const width = posterWidth(columns);
  const height = Math.round(width * 1.5);
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: columns }, (__, col) => (
            <View key={col} style={{ width }}>
              <View style={[styles.poster, { height }]} />
              <View style={[styles.line, { width: width * (0.55 + ((row + col) % 3) * 0.12) }]} />
              <View style={[styles.line, styles.lineShort]} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { gap: GRID_ROW_GAP },
  row: { flexDirection: "row", gap: GRID_GAP },
  poster: {
    borderRadius: TV_STAGE.card.poster.radius,
    backgroundColor: white(0.07),
    borderWidth: 1,
    borderColor: white(0.06),
  },
  line: { height: 22, borderRadius: 11, marginTop: 16, backgroundColor: white(0.09) },
  lineShort: { width: 72, height: 18, borderRadius: 9, marginTop: 10, backgroundColor: white(0.06) },
});
