import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SkeletonCard } from "@/components/ui";
import { ctlGradient, FONT_FAMILY, RADIUS, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * La silhouette de la grille pendant le premier chargement : les colonnes et
 * la gouttière de la vraie (`useGrid`), trois rangées d'affiches 2:3 avec
 * leurs deux lignes de légende. Plus d'écran vide entre la barre et la grille.
 */
export const CatalogGridSkeleton = memo(function CatalogGridSkeleton({ columns, itemWidth, gutter, padding, rows = 3 }: {
  columns: number;
  itemWidth: number;
  gutter: number;
  padding: number;
  rows?: number;
}) {
  const { t } = useTranslation("library");
  const st = useThemedStyles(makeStyles);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("loading")}
      style={[st.skeleton, { paddingHorizontal: padding, columnGap: gutter }]}
    >
      {Array.from({ length: columns * rows }, (_, i) => (
        <View key={i} style={{ width: itemWidth, marginBottom: spacing.md }}>
          <SkeletonCard width={itemWidth} height={itemWidth * 1.5} />
          <View style={[st.line, { width: itemWidth * 0.75 }]} />
          <View style={[st.line, st.lineShort, { width: itemWidth * 0.35 }]} />
        </View>
      ))}
    </View>
  );
});

/**
 * Rien à montrer. Une pastille d'icône cerclée du dégradé de marque, un titre
 * et une piste ; quand ce sont les filtres qui vident la grille, le bouton
 * qui les lève. Sans filtre, la bibliothèque est réellement vide : on le dit.
 */
export const CatalogEmpty = memo(function CatalogEmpty({ filtered, onReset }: { filtered: boolean; onReset?: () => void }) {
  const { t } = useTranslation(["common", "library"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);
  return (
    <View style={st.empty}>
      <LinearGradient colors={gradient.colors} locations={gradient.locations} start={gradient.start} end={gradient.end} style={st.ring}>
        <View style={st.ringInner}>
          <Feather name={filtered ? "filter" : "film"} size={28} color={theme.colors.brand.light} />
        </View>
      </LinearGradient>
      <Text style={st.title} accessibilityRole="header">
        {filtered ? t("library:emptyFilteredTitle") : t("library:emptyTitle")}
      </Text>
      <Text style={st.hint}>{filtered ? t("library:emptyFilteredHint") : t("library:emptyHint")}</Text>
      {filtered && onReset && (
        <Pressable
          onPress={onReset}
          accessibilityRole="button"
          style={({ pressed }) => [st.cta, pressed && st.pressed]}
        >
          <Text style={st.ctaText}>{t("common:resetFilters")}</Text>
        </Pressable>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) => StyleSheet.create({
  skeleton: { flexDirection: "row", flexWrap: "wrap" },
  line: { height: 10, borderRadius: 5, marginTop: spacing.sm, backgroundColor: t.colors.fill.subtle },
  lineShort: { height: 8, marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl, gap: spacing.sm },
  ring: { width: 76, height: 76, borderRadius: 38, padding: 1.5, marginBottom: spacing.sm },
  ringInner: { flex: 1, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surface.s1 },
  title: { ...typography.subtitle, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, textAlign: "center" },
  hint: { ...typography.caption, color: t.colors.text.tertiary, textAlign: "center", maxWidth: 320 },
  cta: {
    marginTop: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.cta.primaryBg,
  },
  ctaText: { ...typography.body, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.primaryFg },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
});
