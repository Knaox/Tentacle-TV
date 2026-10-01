import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { SoftGradient } from "../background/SoftGradient";
import { useFocusProgress } from "../focus/useFocusProgress";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, scrim, white } from "../theme/tokens";
import type { AbsentModel, AbsentTone } from "./cardTypes";
import { GreyscaleImage } from "./GreyscaleImage";

/**
 * Le visage d'un titre ABSENT de la bibliothèque, dans le cadre de sa carte :
 * son affiche (TMDB) en niveaux de gris, sous un voile qui l'assombrit — et
 * s'allège au focus, sans rien redessiner (opacité seule) —, puis son badge en
 * bas à gauche, là où une carte de la bibliothèque porte sa note. Sans
 * affiche (serveur plus ancien, titre sans image chez TMDB) : un cadre qui
 * écrit le titre et l'année, jamais une fausse affiche.
 *
 * Le badge dit « Pas dans la bibliothèque », ou l'état de la demande du titre
 * quand le serveur sait en faire ; le ton choisit la couleur et le glyphe,
 * le texte porte toujours le sens.
 */

/** Le voile : au repos, l'affiche recule ; au focus, elle se lit. */
const VEIL_REST = 0.42;
const VEIL_FOCUSED = 0.16;
/** Le badge, au pied de l'image : la place de la note sur les autres cartes. */
const BADGE_INSET = 12;

const TONE_COLOR: Record<AbsentTone, string> = {
  neutral: white(0.92),
  pending: colors.accentLight,
  active: colors.accentLight,
  ready: colors.successFg,
  blocked: colors.warningFg,
};

const TONE_GLYPH: Partial<Record<AbsentTone, IconName>> = {
  pending: "clock",
  ready: "check",
  blocked: "alert",
};

const Badge = memo(function Badge({ absent, maxWidth }: { absent: AbsentModel; maxWidth: number }) {
  const color = TONE_COLOR[absent.tone];
  const glyph = TONE_GLYPH[absent.tone];
  return (
    <View style={[styles.badge, { maxWidth }]}>
      {glyph ? <Icon name={glyph} size={20} color={color} strokeWidth={2.4} /> : null}
      <Text style={[styles.badgeText, { color }]} numberOfLines={2}>{absent.label}</Text>
    </View>
  );
});

/** Le cadre d'un titre sans affiche : son nom et son année, écrits. */
function Lettered({ title, year, width, height }: { title: string; year?: string; width: number; height: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <SoftGradient width={width} height={height} colors={[white(0.1), white(0.03)]} />
      <View style={styles.lettered}>
        <Icon name="film" size={34} color={white(0.42)} />
        <View style={styles.letteredText}>
          <Text style={styles.letteredTitle} numberOfLines={4}>{title}</Text>
          {year ? <Text style={styles.letteredYear}>{year}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export const AbsentArtwork = memo(function AbsentArtwork({
  absent,
  uri,
  title,
  year,
  width,
  height,
  focused,
}: {
  absent: AbsentModel;
  uri?: string;
  title: string;
  year?: string;
  width: number;
  height: number;
  focused: boolean;
}) {
  const p = useFocusProgress(focused);
  const veil = useAnimatedStyle(() => ({ opacity: VEIL_REST + (VEIL_FOCUSED - VEIL_REST) * p.value }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {uri ? <GreyscaleImage uri={uri} width={width} height={height} /> : <Lettered title={title} year={year} width={width} height={height} />}
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]} />
      <Badge absent={absent} maxWidth={width - 2 * BADGE_INSET} />
    </View>
  );
});

const styles = StyleSheet.create({
  veil: { backgroundColor: scrim(1) },
  badge: {
    position: "absolute",
    left: BADGE_INSET,
    bottom: BADGE_INSET,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: scrim(0.72),
  },
  badgeText: { ...fonts.bold, fontSize: 22, lineHeight: 27, flexShrink: 1 },
  lettered: { flex: 1, padding: 22, justifyContent: "space-between", paddingBottom: 64 },
  letteredText: { gap: 6 },
  letteredTitle: { ...fonts.bold, fontSize: 26, lineHeight: 31, color: white(0.78) },
  letteredYear: { ...fonts.medium, fontSize: 22, color: colors.textSecondary },
});
