import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { SwipeCounts } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme } from "@/theme";

interface Props {
  counts: SwipeCounts;
  libraryOnly: boolean;
}

/**
 * Mode d'emploi du geste, compteurs — et la ligne « bibliothèque seulement ».
 * Le titre n'est plus écrit : le segment « Pour vous · Affiner », juste
 * au-dessus, dit déjà où l'on est.
 */
export const SwipeHeaderNative = memo(function SwipeHeaderNative({ counts, libraryOnly }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const c = theme.colors;
  const chips = [
    { key: "like", icon: "heart" as const, n: counts.like, color: c.status.success, label: t("countLike", { count: counts.like }) },
    { key: "super", icon: "star" as const, n: counts.superlike, color: c.brand.accentLight, label: t("countSuper", { count: counts.superlike }) },
    { key: "dislike", icon: "x" as const, n: counts.dislike, color: c.status.error, label: t("countDislike", { count: counts.dislike }) },
  ];
  return (
    <View style={st.wrap}>
      <View style={st.row}>
        <Text style={[typography.caption, st.hint, { color: c.text.tertiary }]}>{t("hint")}</Text>
        <View style={st.chips} accessibilityLabel={t("countsLabel")}>
          {chips.map((chip) => (
            <View
              key={chip.key}
              style={[st.chip, { backgroundColor: c.fill.subtle, borderColor: c.border.subtle }]}
              accessible
              accessibilityLabel={chip.label}
            >
              <Feather name={chip.icon} size={12} color={chip.color} />
              <Text style={[st.chipText, { color: c.text.primary }]}>{chip.n}</Text>
            </View>
          ))}
        </View>
      </View>
      {libraryOnly && (
        <View style={[st.notice, { backgroundColor: c.fill.subtle, borderColor: c.border.subtle }]} accessibilityRole="text">
          <Feather name="book" size={14} color={c.brand.light} />
          <Text style={[typography.caption, st.noticeText, { color: c.text.secondary }]}>{t("libraryOnlyShort")}</Text>
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { gap: 6, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  hint: { flex: 1 },
  chips: { flexDirection: "row", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, fontWeight: "600", fontVariant: ["tabular-nums"] },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  noticeText: { flex: 1 },
});
