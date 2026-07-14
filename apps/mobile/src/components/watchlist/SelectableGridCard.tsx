import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { PressableCard, ProgressBar } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

const POSTER_ASPECT = 2 / 3;

export interface SelectableGridCardProps {
  /** URL de l'affiche (Primary 300x). */
  posterUri: string;
  title: string;
  year?: number | null;
  /** Progression 0-100 (côté Jellyfin) — caché si null/0 ou si vu. */
  progressPercent?: number | null;
  watched?: boolean;
  width: number;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Carte grille générique (poster 2:3 + titre + année) avec overlay multi-select
 * et badge "vu". Utilisée par Watchlist, Favoris et SharedWatchlist detail.
 *
 * Style cinematic : surface s2, radius lg, halo violet quand sélectionnée,
 * progress bar bas-screen, badge violet rond pour items vus.
 */
export const SelectableGridCard = memo(function SelectableGridCard({
  posterUri,
  title,
  year,
  progressPercent,
  watched,
  width,
  selectable,
  selected,
  onPress,
  onLongPress,
  accessibilityLabel,
}: SelectableGridCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const showProgress = progressPercent != null && progressPercent > 0 && !watched;

  return (
    <PressableCard
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width, marginBottom: spacing.md }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <View style={styles.poster}>
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        {showProgress && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={(progressPercent ?? 0) / 100} height={3} />
          </View>
        )}
        {watched && (
          <View style={styles.watchedBadge} accessibilityLabel="vu">
            <Feather name="check" size={12} color={colors.cta.primaryFg} />
          </View>
        )}
        {selectable && (
          <View style={[StyleSheet.absoluteFill, styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View style={[styles.checkbox, selected && styles.checkboxActive]}>
              {selected && <Feather name="check" size={14} color={colors.brand.light} />}
            </View>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.itemTitle}>{title}</Text>
      {year != null && <Text style={styles.itemYear}>{year}</Text>}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    poster: {
      aspectRatio: POSTER_ASPECT,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    progressContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },
    // R11 — Watched check unifié (web/mobile) : pill haut-contraste + check inversé + shadow.
    // Match desktop apps/web/src/components/cards/PosterCard.tsx:90.
    watchedBadge: {
      position: "absolute",
      top: 7,
      right: 7,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: t.colors.cta.primaryBg,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 4,
      elevation: 4,
    },
    itemTitle: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.primary,
      marginTop: spacing.xs + 2,
      letterSpacing: -0.1,
    },
    itemYear: {
      ...typography.badge,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.text.tertiary,
      marginTop: 2,
    },
    selectOverlay: {
      backgroundColor: t.colors.overlay.scrimSoft,
      justifyContent: "flex-start",
      alignItems: "flex-end",
      padding: spacing.xs,
      borderRadius: RADIUS.lg,
    },
    selectOverlayActive: {
      borderWidth: 2,
      borderColor: t.colors.brand.violet,
      backgroundColor: withAlpha(t.colors.brand.violet, 0.18, t.colors.brand.ghost),
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: t.colors.cta.brandFg,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: t.colors.overlay.scrimSoft,
    },
    checkboxActive: {
      backgroundColor: t.colors.brand.soft,
      borderColor: withAlpha(t.colors.brand.violet, 0.5, t.colors.brand.glow),
    },
  });
