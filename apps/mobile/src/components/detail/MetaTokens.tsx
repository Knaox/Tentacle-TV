import { View, Text, StyleSheet } from "react-native";
import { extractMediaQuality } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

/**
 * Méta qualité/langues en tokens discrets (jumeau RN de MetaChips web) —
 * monochrome, secondaire ; seul le 4K porte un léger accent brand. Codec
 * volontairement omis (trop technique). Alimenté par la logique partagée
 * `extractMediaQuality` (qualité + audioLabels VF/VFQ/VOSTFR/EN…).
 */
export function MetaTokens({ item, compact = false }: { item?: MediaItem; compact?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const q = extractMediaQuality(item);

  const tokens: { label: string; accent?: boolean }[] = [];
  if (q.resolution === "4K") tokens.push({ label: "4K", accent: true });
  else if (q.resolution === "FHD") tokens.push({ label: "1080P" });
  else if (q.resolution === "HD") tokens.push({ label: "720P" });
  if (q.isDolbyVision) tokens.push({ label: "Vision" });
  else if (q.isHDR) tokens.push({ label: "HDR" });
  if (q.isDolbyAtmos) tokens.push({ label: "Atmos" });

  const langs = q.audioLabels.map((l) => l.token).slice(0, 3);
  if (tokens.length === 0 && langs.length === 0) return null;

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {tokens.map((tk) => (
        <View key={tk.label} style={[styles.chip, tk.accent && styles.chipAccent]}>
          <Text style={[styles.txt, tk.accent && styles.txtAccent]}>{tk.label}</Text>
        </View>
      ))}
      {langs.length > 0 && (
        <View style={styles.chip}>
          <Text style={styles.txt}>{langs.join(" · ")}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 10 },
    rowCompact: { marginTop: 4, gap: 5 },
    chip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 5,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
    },
    chipAccent: {
      backgroundColor: t.colors.brand.soft,
      borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
    },
    txt: {
      fontSize: 10.5,
      fontFamily: FONT_FAMILY.semibold,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: t.colors.text.secondary,
    },
    txtAccent: { color: t.colors.brand.light },
  });
