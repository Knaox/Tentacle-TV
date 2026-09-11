import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  /** Note globale /10. `null` ou `<= 0` : rien n'est rendu. */
  rating: number | null | undefined;
  /** Autre ancrage que le coin bas-gauche de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

/**
 * La note d'une carte — le jumeau du badge web, et rien de plus.
 *
 * Ce qui est PARTAGÉ entre les plateformes, c'est la règle qui décide QUELLE
 * note poser (`cardRatingFor`, dans `@tentacle-tv/shared`) : c'est elle qui ne
 * doit pas diverger. La présentation, elle, s'écrit ici, parce qu'aucun paquet
 * du dépôt ne peut accueillir un composant React Native — `packages/ui` a
 * `react-dom` en pair, `packages/tv-core` s'interdit tout rendu — et qu'un
 * paquet de plus exigerait deux résolutions Metro et un verrou de dépendances
 * modifié, que la CI lit gelé.
 *
 * Le compte de duplication BAISSE malgré tout : l'étoile posée en dur dans la
 * carte de recommandation devient un appel à ce composant.
 */
export const CardRatingBadge = memo(function CardRatingBadge({ rating, style }: Props) {
  const { t } = useTranslation("reco");
  const st = useThemedStyles(makeStyles);
  if (rating == null || rating <= 0) return null;
  const score = rating.toFixed(1);

  return (
    <View style={[st.badge, style]} accessibilityLabel={t("communityRatingAria", { score })}>
      <Text style={st.star}>★</Text>
      <Text style={st.score}>{score}</Text>
    </View>
  );
});

// Posé SUR une affiche : noir et blanc constants dans les deux thèmes, seule
// l'étoile prend l'accent de marque. Même géométrie que le badge du web.
const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    badge: {
      position: "absolute",
      bottom: 6,
      left: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.2)",
      backgroundColor: "rgba(0,0,0,0.65)",
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    star: { fontSize: 10, lineHeight: 13, color: t.colors.brand.accent },
    score: {
      fontSize: 11,
      lineHeight: 13,
      fontFamily: FONT_FAMILY.semibold,
      color: "#FFFFFF",
    },
  });
