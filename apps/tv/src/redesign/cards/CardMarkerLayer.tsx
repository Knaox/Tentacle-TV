import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { STAR_PATH, STAR_VIEWBOX, formatCommunityRating, formatUserScore, type CardMarkers } from "@tentacle-tv/shared";
import { BrandGradient } from "../brand/BrandGradient";
import { colors, fonts, scrim } from "../theme/tokens";
import { MARKER_INSET, RATING_PILL, showsRating } from "./cardMarkerGeometry";
import { ToggleGlyph } from "./ToggleGlyph";

/**
 * Les marqueurs AU REPOS d'une carte, comme sur toutes les plateformes : note
 * globale et note perso en bas à gauche, pastille Ma liste · favori · vu en
 * haut à droite, barre de progression commune. Tracés du modèle partagé
 * (`cardMarkerGlyphs`), voile noir des pastilles du bureau (0,72). Au focus,
 * rien ne change : sur Apple TV, la carte n'a pas d'autre face — ses actions
 * vivent dans le grand panneau de l'appui maintenu.
 */

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox={STAR_VIEWBOX}>
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  );
}

export const CardMarkerLayer = memo(function CardMarkerLayer({
  markers,
  progress,
  compact = false,
  hideRating = false,
}: {
  markers: CardMarkers;
  progress?: number;
  compact?: boolean;
  hideRating?: boolean;
}) {
  const glyph = compact ? RATING_PILL.glyphCompact : RATING_PILL.glyph;
  const showRating = showsRating(markers, hideRating);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {markers.statuses.length > 0 ? (
        <View style={[styles.pill, styles.statuses, compact && styles.pillCompact]}>
          {markers.statuses.map((kind) => (
            <ToggleGlyph key={kind} kind={kind} active color={kind === "favorite" ? colors.accentLight : colors.onMedia} size={glyph} />
          ))}
        </View>
      ) : null}
      {showRating ? (
        <View style={[styles.pill, styles.rating, compact && styles.pillCompact, progress !== undefined && styles.ratingAboveBar]}>
          {markers.communityRating !== null ? (
            <>
              <Star size={glyph - 2} color={colors.accentLight} />
              <Text style={[styles.value, compact && styles.valueCompact]}>{formatCommunityRating(markers.communityRating)}</Text>
            </>
          ) : null}
          {markers.userScore !== null ? (
            <View style={styles.userScore}>
              {/* Le dégradé de la marque, comme la note perso du bureau (`CardRatingBadge`). */}
              <BrandGradient style={styles.userScoreFill} />
              <Star size={glyph - RATING_PILL.user.starInset} color={colors.onAccent} />
              <Text style={[styles.userValue, compact && styles.valueCompact]}>{formatUserScore(markers.userScore)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {progress !== undefined && progress > 0.01 ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(Math.min(1, progress) * 100)}%` }]}>
            <BrandGradient />
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: RATING_PILL.gap,
    height: RATING_PILL.height,
    paddingHorizontal: RATING_PILL.padding,
    borderRadius: 20,
    backgroundColor: scrim(0.72),
  },
  pillCompact: { height: RATING_PILL.heightCompact, paddingHorizontal: RATING_PILL.paddingCompact, borderRadius: 17, gap: RATING_PILL.gapCompact },
  statuses: { top: MARKER_INSET, right: MARKER_INSET },
  rating: { left: MARKER_INSET, bottom: RATING_PILL.bottom },
  ratingAboveBar: { bottom: RATING_PILL.bottomAboveBar },
  value: { ...fonts.bold, fontSize: RATING_PILL.fontSize, color: colors.onMedia },
  valueCompact: { fontSize: RATING_PILL.fontSize },
  userScore: {
    flexDirection: "row",
    alignItems: "center",
    gap: RATING_PILL.user.gap,
    paddingHorizontal: RATING_PILL.user.padding,
    height: RATING_PILL.user.height,
    borderRadius: RATING_PILL.user.height / 2,
    overflow: "hidden",
  },
  // Android ne rogne pas un dégradé enfant d'un parent arrondi sans fond : il prend l'arrondi lui-même.
  userScoreFill: { borderRadius: RATING_PILL.user.height / 2 },
  userValue: { ...fonts.extrabold, fontSize: RATING_PILL.fontSize, color: colors.onAccent },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(255, 255, 255, 0.22)" },
  fill: { height: 6, overflow: "hidden" },
});
