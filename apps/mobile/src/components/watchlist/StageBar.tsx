import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { WATCH_STAGE_FILTERS, type WatchStageFilter, type WatchlistSummary } from "@tentacle-tv/api-client";
import { ctlGradient, spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const LABEL: Record<WatchStageFilter, string> = {
  all: "stageAll",
  new: "stageNew",
  inProgress: "stageInProgress",
  watched: "stageWatched",
};

const count = (s: WatchStageFilter, c: WatchlistSummary) => (s === "all" ? c.total : c[s]);

/**
 * Les étapes de visionnage, entre le champ et la barre rapide — là où la
 * Bibliothèque pose son statut. Pastilles de 36 qui défilent sous le pouce, à
 * la peau de la barre rapide (aplat opaque, liseré fort) ; l'active au
 * dégradé de marque. Une étape vide disparaît, sauf l'active. La bascule
 * grille / liste a rejoint la barre rapide.
 */
export const StageBar = memo(function StageBar({
  stage, onStageChange, counts,
}: {
  stage: WatchStageFilter;
  onStageChange: (s: WatchStageFilter) => void;
  counts: WatchlistSummary;
}) {
  const { t } = useTranslation("watchlist");
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const stages = WATCH_STAGE_FILTERS.filter((s) => s === "all" || s === stage || count(s, counts) > 0);
  const gradient = ctlGradient(colors.brand);

  return (
    <View style={styles.row}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
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
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { paddingTop: spacing.sm, paddingBottom: spacing.xs },
    chips: { paddingHorizontal: spacing.screenPadding, gap: spacing.sm, alignItems: "center" },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      borderRadius: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      overflow: "hidden",
    },
    chipIdle: { backgroundColor: t.colors.surface.s1, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border.strong },
    chipText: { fontFamily: FONT_FAMILY.semibold, fontSize: 13, color: t.colors.text.secondary },
    chipTextActive: { color: "#FFFFFF" },
    chipCount: { fontFamily: FONT_FAMILY.bold, fontSize: 11, color: t.colors.text.quaternary, fontVariant: ["tabular-nums"] },
    chipCountActive: { color: "rgba(255,255,255,0.85)" },
    pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  });
