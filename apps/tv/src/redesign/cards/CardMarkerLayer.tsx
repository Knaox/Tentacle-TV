import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  BOOKMARK_PATH,
  HEART_PATH,
  STAR_PATH,
  STAR_VIEWBOX,
  WATCHED_FILLED_PATH,
  formatCommunityRating,
  formatUserScore,
  type CardMarkers,
  type CardStatusKind,
} from "@tentacle-tv/shared";
import { colors, fonts, scrim } from "../theme/tokens";

/**
 * Les marqueurs AU REPOS d'une carte, comme sur toutes les plateformes : note
 * globale et note perso en bas à gauche, pastille Ma liste · favori · vu en
 * haut à droite, barre de progression commune. Tracés du modèle partagé
 * (`cardMarkerGlyphs`), voile noir des pastilles du bureau (0,72).
 */

const GLYPH: Record<CardStatusKind, string> = {
  watchlist: BOOKMARK_PATH,
  favorite: HEART_PATH,
  watched: WATCHED_FILLED_PATH,
};

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
  const glyph = compact ? 18 : 22;
  const showRating = !hideRating && (markers.communityRating !== null || markers.userScore !== null);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {markers.statuses.length > 0 ? (
        <View style={[styles.pill, styles.statuses, compact && styles.pillCompact]}>
          {markers.statuses.map((kind) => (
            <Svg key={kind} width={glyph} height={glyph} viewBox="0 0 24 24">
              {/* « vu » est un disque à la coche ÉVIDÉE : sans `evenodd`, la coche se
                  remplit et la pastille ne montre qu'un rond blanc. */}
              <Path
                key={kind}
                d={GLYPH[kind]}
                fill={kind === "favorite" ? colors.accentLight : colors.onMedia}
                fillRule={kind === "watched" ? "evenodd" : "nonzero"}
              />
            </Svg>
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
              <Star size={glyph - 6} color={colors.onAccent} />
              <Text style={[styles.userValue, compact && styles.valueCompact]}>{formatUserScore(markers.userScore)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {progress !== undefined && progress > 0.01 ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(Math.min(1, progress) * 100)}%` }]} />
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
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: scrim(0.72),
  },
  pillCompact: { height: 34, paddingHorizontal: 10, borderRadius: 17, gap: 6 },
  statuses: { top: 12, right: 12 },
  rating: { left: 12, bottom: 12 },
  ratingAboveBar: { bottom: 20 },
  value: { ...fonts.bold, fontSize: 22, color: colors.onMedia },
  valueCompact: { fontSize: 22 },
  userScore: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentLight,
  },
  userValue: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 6, backgroundColor: "rgba(255, 255, 255, 0.22)" },
  fill: { height: 6, backgroundColor: colors.accent },
});
