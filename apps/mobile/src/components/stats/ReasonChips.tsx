import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Heart, Repeat, Sparkles, Star, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react-native";
import type { StatsTitleReason } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { StatsFormat } from "./useStatsFormat";

export interface ReasonChip {
  key: string;
  label: string;
  /** Ce que lit le lecteur d'écran quand le libellé ne suffit pas (« Votre note : 8 sur 10 »). */
  accessibilityLabel?: string;
  Icon?: LucideIcon;
}

const ICONS: Record<StatsTitleReason["kind"], LucideIcon> = {
  rating: Star,
  superlike: Sparkles,
  like: ThumbsUp,
  dislike: ThumbsDown,
  favorite: Heart,
  viewings: Repeat,
};

/** L'étoile de la note et le cœur du favori sont pleins, comme sur les cartes. */
const FILLED = new Set(["rating", "favorite"]);

/** Les avis d'un titre en étiquettes — celles du web (`ReasonChips`), mêmes icônes. */
export function reasonChips(f: StatsFormat, reasons: readonly StatsTitleReason[]): ReasonChip[] {
  const out: ReasonChip[] = [];
  for (const r of reasons) {
    if (r.kind === "viewings") continue;
    if (r.kind === "rating") {
      const value = f.number(r.value, r.value % 1 ? 1 : 0);
      out.push({ key: r.kind, label: value, accessibilityLabel: f.t("chipRating", { rating: value }), Icon: ICONS.rating });
      continue;
    }
    out.push({ key: r.kind, label: f.t(`reason_${r.kind}`), Icon: ICONS[r.kind] });
  }
  return out;
}

/** Des étiquettes neutres, l'icône seule à la couleur de la marque. */
export const ReasonChips = memo(function ReasonChips({ chips }: { chips: ReasonChip[] }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const tint = theme.colors.brand.light;
  return (
    <View style={st.row}>
      {chips.map(({ key, label, Icon }) => (
        <View key={key} style={st.chip}>
          {Icon ? <Icon size={11} color={tint} fill={FILLED.has(key) ? tint : "none"} strokeWidth={2.2} /> : null}
          <Text style={st.label}>{label}</Text>
        </View>
      ))}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      height: 20,
      paddingHorizontal: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.soft,
    },
    label: { fontSize: 11, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.secondary, fontVariant: ["tabular-nums"] },
  });
