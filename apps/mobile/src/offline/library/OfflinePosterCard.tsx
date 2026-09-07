import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableCard, ProgressBar } from "@/components/ui";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";

interface Props {
  title: string;
  subtitle?: string | null;
  /** Item dont le snapshot porte les visuels (l'épisode, ou la série). */
  posterItemId: string;
  /** Fichiers du snapshot, dans l'ordre de préférence. */
  candidates: readonly string[];
  watched: boolean;
  /** Pourcentage entamé, `null` sans reprise. */
  percent: number | null;
  /** Badge dégradé en haut à gauche (« 14 ép. »), comme le « +N » des cartes en ligne. */
  countBadge?: string | null;
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

/**
 * Carte affiche 2:3 du catalogue local — la jumelle de `MobileMediaCard`, les
 * visuels lus dans le snapshot (`file://`), jamais sur le réseau. La lettre de
 * repli reste SOUS l'image : sans fichier elle se voit, avec elle est couverte.
 */
export const OfflinePosterCard = memo(function OfflinePosterCard({
  title, subtitle, posterItemId, candidates, watched, percent, countBadge, width, onPress, onLongPress, accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const progress = percent ?? 0;
  const hasProgress = progress > 0 && progress < 100;

  return (
    <PressableCard
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <View style={st.poster}>
        <View style={st.imageClip} pointerEvents="none">
          <View style={st.fallback}>
            <Text style={st.fallbackLetter}>{title.charAt(0).toUpperCase() || "?"}</Text>
          </View>
          <OfflineLocalImage itemId={posterItemId} candidates={candidates} style={StyleSheet.absoluteFill} />
        </View>
        {hasProgress && (
          <View style={st.progWrap}>
            <ProgressBar progress={progress / 100} height={3} />
          </View>
        )}
        {watched && !hasProgress && (
          <View style={st.watchedBadge}>
            <Feather name="check" size={12} color={theme.colors.cta.primaryFg} />
          </View>
        )}
        {countBadge ? (
          <LinearGradient
            colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={st.countBadge}
          >
            <Text style={st.countBadgeText}>{countBadge}</Text>
          </LinearGradient>
        ) : null}
      </View>
      <Text numberOfLines={1} style={st.title}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={st.subtitle}>{subtitle}</Text> : null}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    poster: {
      aspectRatio: 2 / 3,
      borderRadius: RADIUS.lg,
      backgroundColor: t.colors.surface.s2,
      ...SHADOW_RN.elev2,
    },
    imageClip: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: RADIUS.lg,
      overflow: "hidden",
      backgroundColor: t.colors.surface.s2,
    },
    fallback: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    fallbackLetter: {
      fontSize: 36,
      fontFamily: FONT_FAMILY.extrabold,
      color: t.colors.text.disabled,
      letterSpacing: -0.5,
    },
    progWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
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
    countBadge: {
      position: "absolute",
      top: 7,
      left: 7,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 3,
      shadowColor: t.colors.brand.violet,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 4,
    },
    countBadgeText: { fontSize: 11, lineHeight: 12, fontFamily: FONT_FAMILY.bold, color: t.colors.cta.brandFg },
    title: {
      ...typography.small,
      fontSize: 13,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.primary,
      marginTop: 8,
      letterSpacing: -0.1,
    },
    subtitle: { ...typography.badge, color: t.colors.text.tertiary, marginTop: 2 },
  });
