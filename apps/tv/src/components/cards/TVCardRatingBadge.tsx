import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTranslation } from "react-i18next";
import { BRAND, formatCommunityRating, formatUserScore } from "@tentacle-tv/shared";
import { Colors, Fonts } from "../../theme/colors";
import { TVStarGlyph } from "./tvCardGlyphs";

interface Props {
  /** Note globale /10. `null` ou `<= 0` : pas de segment global. */
  rating: number | null | undefined;
  /** Note de l'utilisateur, 1..10 : un second segment, au dégradé de marque. */
  userScore?: number | null;
  /** Autre ancrage que le coin bas-gauche de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

/**
 * La note d'une affiche du salon.
 *
 * Le jumeau des badges du web et du mobile, à une différence près : la taille.
 * Un téléviseur se lit à trois mètres, la note est donc en 13 plutôt qu'en 11,
 * et la pastille respire un peu plus. La règle qui décide QUELLE note poser,
 * et le dessin de l'étoile, vivent dans `@tentacle-tv/shared`.
 *
 * Deux segments au plus, sur la même échelle (/10) : la note globale, puis la
 * vôtre sur le dégradé violet → rose. Noir et blanc constants : posé sur une
 * affiche, rien ne suit le thème.
 */
export const TVCardRatingBadge = memo(function TVCardRatingBadge({ rating, userScore = null, style }: Props) {
  const { t } = useTranslation("cards");
  const community = rating != null && rating > 0 ? formatCommunityRating(rating) : null;
  const mine = userScore != null && userScore > 0 ? formatUserScore(userScore) : null;
  if (!community && !mine) return null;

  const label = [
    community ? t("communityRating", { score: community }) : null,
    mine ? t("userRating", { score: mine }) : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={[styles.badge, style]} accessible accessibilityLabel={label}>
      {community && (
        <View style={styles.segment}>
          <TVStarGlyph size={12} color={Colors.accentPink} />
          <Text style={styles.score}>{community}</Text>
        </View>
      )}
      {mine && (
        <LinearGradient
          colors={[BRAND.violet, Colors.accentPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.segment}
        >
          <TVStarGlyph size={11} color="#FFFFFF" />
          <Text style={styles.score}>{mine}</Text>
        </LinearGradient>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: 8,
    left: 8,
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
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  score: { fontSize: 13, color: "#FFFFFF", fontFamily: Fonts.bold },
});
