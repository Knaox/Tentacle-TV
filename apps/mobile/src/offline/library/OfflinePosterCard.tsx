import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PressableCard, ProgressBar } from "@/components/ui";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { CardRatingBadge } from "@/components/cards/CardRatingBadge";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";

const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];

interface Props {
  title: string;
  subtitle?: string | null;
  /** Item dont le snapshot porte les visuels (l'épisode, ou la série). */
  posterItemId: string;
  /** Fichiers du snapshot, dans l'ordre de préférence. */
  candidates: readonly string[];
  watched: boolean;
  /** Note globale lue dans le snapshot du disque par l'appelant. */
  rating?: number | null;
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
 *
 * Marqueurs du repos dans la grammaire unifiée des cartes : la note en bas à
 * gauche (remontée au-dessus d'une barre de progression), la pastille d'états
 * en haut à droite — ici la seule coche « vu », l'état que l'appareil connaît.
 */
export const OfflinePosterCard = memo(function OfflinePosterCard({
  title, subtitle, posterItemId, candidates, watched, rating = null, percent, countBadge, width, onPress, onLongPress, accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const progress = watched ? 0 : (percent ?? 0);
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
        <CardRatingBadge rating={rating} style={hasProgress ? LIFTED : undefined} />
        <CardStatusMarkers statuses={watched ? WATCHED : NONE} />
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

const LIFTED = { bottom: 14 } as const;
