import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { GlassSurface } from "../../glass/GlassSurface";
import { colors, fonts, white } from "../../theme/tokens";
import { TOP_HIT_HEIGHT } from "./SearchTopHit";
import { RESULTS_CLIP, RESULTS_WIDTH } from "./searchViewModel";

/**
 * La première réponse n'est pas encore là : la place qu'elle prendra, en
 * verre immobile — la bannière, un titre de rangée, des affiches. Rien ne
 * clignote (aucune boucle) ; « Recherche… » dit ce qui se passe.
 */
export const SearchLoading = memo(function SearchLoading({ label }: { label: string }) {
  const poster = TV_STAGE.card.poster;
  return (
    <View style={styles.page}>
      <Text style={styles.label}>{label}</Text>
      <GlassSurface radius={32} tone="regular" style={styles.top}>
        <View style={styles.lines}>
          <View style={[styles.bar, { width: 180, height: 18 }]} />
          <View style={[styles.bar, { width: 420, height: 64 }]} />
          <View style={[styles.bar, { width: 340, height: 24 }]} />
        </View>
      </GlassSurface>
      <View style={[styles.bar, styles.rowTitle]} />
      <View style={styles.row}>
        {[0, 1, 2, 3, 4].map((i) => (
          <GlassSurface key={i} radius={poster.radius} tone="regular" style={{ width: poster.width, height: poster.height }} />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: TV_STAGE.safe.y, paddingLeft: RESULTS_CLIP },
  label: { ...fonts.semibold, fontSize: 26, color: colors.textTertiary, marginBottom: 22 },
  top: { width: RESULTS_WIDTH, height: TOP_HIT_HEIGHT, justifyContent: "center" },
  lines: { paddingLeft: 52, gap: 22 },
  bar: { borderRadius: 12, backgroundColor: white(0.08) },
  rowTitle: { width: 220, height: 36, marginTop: 56, marginBottom: TV_STAGE.row.titleGap + 4 },
  row: { flexDirection: "row", gap: TV_STAGE.row.gap },
});
