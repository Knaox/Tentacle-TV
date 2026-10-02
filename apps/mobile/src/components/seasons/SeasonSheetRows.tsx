import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { SeasonPickRow, SeasonPickTone } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Les lignes de la feuille des saisons au téléphone (`seasonPick`, le modèle
 * commun) : une saison qui se demande se COCHE — la ligne entière, 52 de
 * haut ; une saison qui ne se demande pas dit où elle en est, d'un glyphe ET
 * d'un mot (« Dans la bibliothèque », « Demandée »), jamais de la couleur
 * seule.
 */

const GLYPH: Record<SeasonPickTone, "check" | "clock" | "lock"> = { ready: "check", pending: "clock", neutral: "lock" };

function SettledRow({ row }: { row: SeasonPickRow }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const tone = row.status?.tone ?? "neutral";
  const pair = tone === "ready" ? theme.colors.statusPairs.success : tone === "pending" ? theme.colors.statusPairs.info : null;
  return (
    <View style={st.row} accessible accessibilityLabel={row.status?.label ? `${row.label}, ${row.status.label}` : row.label}>
      <Text style={st.settledLabel} numberOfLines={1}>{row.label}</Text>
      {row.status?.label ? (
        <View style={[st.pill, { backgroundColor: pair?.bg ?? theme.colors.fill.medium }]}>
          <Feather name={GLYPH[tone]} size={12} color={pair?.fg ?? theme.colors.text.secondary} />
          <Text style={[st.pillText, { color: pair?.fg ?? theme.colors.text.secondary }]} numberOfLines={1}>{row.status.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

function CheckRow({ row, onToggle }: { row: SeasonPickRow; onToggle: (number: number) => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => onToggle(row.number)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: row.selected }}
      accessibilityLabel={row.detail ? `${row.label}, ${row.detail}` : row.label}
      style={({ pressed }) => [st.row, pressed && { backgroundColor: theme.colors.fill.soft }]}
    >
      {row.selected ? (
        <LinearGradient colors={[theme.colors.brand.violet, theme.colors.brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.box}>
          <Feather name="check" size={15} color={theme.colors.cta.brandFg} />
        </LinearGradient>
      ) : (
        <View style={[st.box, st.boxEmpty]} />
      )}
      <Text style={st.label} numberOfLines={1}>{row.label}</Text>
      {row.detail ? <Text style={st.detail} numberOfLines={1}>{row.detail}</Text> : null}
    </Pressable>
  );
}

export const SeasonSheetRows = memo(function SeasonSheetRows({ rows, onToggle }: {
  rows: readonly SeasonPickRow[];
  onToggle: (number: number) => void;
}) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.list}>
      {rows.map((row) => (row.status
        ? <SettledRow key={row.number} row={row} />
        : <CheckRow key={row.number} row={row} onToggle={onToggle} />))}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    list: { gap: 2, paddingHorizontal: spacing.sm },
    row: {
      minHeight: 52,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
      paddingHorizontal: spacing.md,
      borderRadius: RADIUS.md,
    },
    box: { width: 24, height: 24, borderRadius: 7, alignItems: "center" as const, justifyContent: "center" as const },
    boxEmpty: { borderWidth: 2, borderColor: t.colors.border.strong, backgroundColor: t.colors.fill.subtle },
    label: { flex: 1, fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    detail: { fontSize: 13, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, fontVariant: ["tabular-nums"] },
    settledLabel: { flex: 1, fontSize: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
    pill: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: RADIUS.pill,
      maxWidth: "60%",
    },
    pillText: { fontSize: 12, fontFamily: FONT_FAMILY.semibold },
  });
