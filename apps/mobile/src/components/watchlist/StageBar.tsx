import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { WATCH_STAGE_FILTERS, type WatchStageFilter, type WatchlistSummary } from "@tentacle-tv/api-client";
import { ctlGradient, spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

type View_ = "grid" | "list";

const LABEL: Record<WatchStageFilter, string> = {
  all: "stageAll",
  new: "stageNew",
  inProgress: "stageInProgress",
  watched: "stageWatched",
};

const count = (s: WatchStageFilter, c: WatchlistSummary) => (s === "all" ? c.total : c[s]);

/**
 * Les étapes de visionnage en pastilles de 36 qui défilent sous le pouce —
 * l'active au dégradé de marque — et la bascule grille / liste en rond de 44
 * au bout. Une étape vide disparaît, sauf l'active.
 */
export const StageBar = memo(function StageBar({
  stage, onStageChange, counts, view, onViewChange,
}: {
  stage: WatchStageFilter;
  onStageChange: (s: WatchStageFilter) => void;
  counts: WatchlistSummary;
  view: View_;
  onViewChange: (v: View_) => void;
}) {
  const { t } = useTranslation("watchlist");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stages = WATCH_STAGE_FILTERS.filter((s) => s === "all" || s === stage || count(s, counts) > 0);
  const next: View_ = view === "grid" ? "list" : "grid";
  const gradient = ctlGradient(colors.brand);

  return (
    <View style={styles.row}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.scroller}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("stageFilterLabel")}
      >
        {stages.map((s) => {
          const active = s === stage;
          return (
            <Pressable
              key={s}
              onPress={() => onStageChange(s)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={({ pressed }) => [styles.chip, !active && styles.chipIdle, pressed && styles.pressed]}
            >
              {active && <LinearGradient {...gradient} style={StyleSheet.absoluteFill} />}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(LABEL[s])}</Text>
              <Text style={[styles.chipCount, active && styles.chipCountActive]}>{count(s, counts)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable
        onPress={() => onViewChange(next)}
        accessibilityRole="button"
        accessibilityLabel={t(next === "grid" ? "viewGrid" : "viewList")}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Feather name={next === "grid" ? "grid" : "list"} size={18} color={colors.text.secondary} />
      </Pressable>
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", paddingRight: spacing.screenPadding, paddingBottom: spacing.sm, gap: spacing.sm },
    scroller: { flex: 1 },
    chips: { paddingLeft: spacing.screenPadding, gap: spacing.sm, alignItems: "center" },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
    },
    chipIdle: { backgroundColor: t.colors.fill.subtle, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.subtle },
    chipText: { fontFamily: FONT_FAMILY.semibold, fontSize: 13, color: t.colors.text.secondary },
    chipTextActive: { color: "#FFFFFF" },
    chipCount: { fontFamily: FONT_FAMILY.bold, fontSize: 11, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    chipCountActive: { color: "rgba(255,255,255,0.85)" },
    toggle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
    pressed: { opacity: 0.7 },
  });
