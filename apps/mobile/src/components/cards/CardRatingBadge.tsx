import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { formatCommunityRating, formatUserScore } from "@tentacle-tv/shared";
import { FONT_FAMILY, progressGradient, useTheme } from "@/theme";
import { StarGlyph } from "./cardGlyphs";

interface Props {
  /** Note globale /10. `null` ou `<= 0` : pas de segment global. */
  rating: number | null | undefined;
  /**
   * Note de l'utilisateur, 1..10. Présente, elle s'ajoute dans la MÊME
   * pastille, sur un segment au dégradé de marque — « ★ 8.2 | ★ 7 ».
   */
  userScore?: number | null;
  /** Autre ancrage que le coin bas-gauche de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

/**
 * La note d'une carte — le jumeau du badge web.
 *
 * Ce qui est PARTAGÉ entre les plateformes, c'est la règle qui décide QUELLE
 * note poser (`cardRatingFor`, `resolveCardMarkers`, dans `@tentacle-tv/shared`)
 * et le dessin de l'étoile (`cardMarkerGlyphs`) : c'est ce qui ne doit pas
 * diverger. La présentation, elle, s'écrit ici, parce qu'aucun paquet du dépôt
 * ne peut accueillir un composant React Native — `packages/ui` a `react-dom`
 * en pair, `packages/tv-core` s'interdit tout rendu.
 *
 * Deux segments au plus, sur la même échelle (/10) : la note globale, puis la
 * vôtre sur le dégradé violet → rose.
 */
export const CardRatingBadge = memo(function CardRatingBadge({ rating, userScore = null, style }: Props) {
  const { t } = useTranslation("cards");
  const theme = useTheme();
  const community = rating != null && rating > 0 ? formatCommunityRating(rating) : null;
  const mine = userScore != null && userScore > 0 ? formatUserScore(userScore) : null;
  if (!community && !mine) return null;

  const label = [
    community ? t("communityRating", { score: community }) : null,
    mine ? t("userRating", { score: mine }) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const gradient = progressGradient(theme.colors.brand);

  return (
    <View style={[st.badge, style]} accessible accessibilityRole="image" accessibilityLabel={label} pointerEvents="none">
      {community && (
        <View style={st.segment}>
          <StarGlyph size={10} color={theme.colors.brand.accent} />
          <Text style={st.score}>{community}</Text>
        </View>
      )}
      {mine && (
        <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={st.segment}>
          <StarGlyph size={9} color={theme.colors.cta.brandFg} />
          <Text style={[st.score, { color: theme.colors.cta.brandFg }]}>{mine}</Text>
        </LinearGradient>
      )}
    </View>
  );
});

// Posé SUR une affiche : noir et blanc constants dans les deux thèmes, seules
// l'étoile et le segment personnel prennent la marque. Même géométrie que le
// badge du web.
const st = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  score: {
    fontSize: 11,
    lineHeight: 13,
    fontFamily: FONT_FAMILY.semibold,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
});
