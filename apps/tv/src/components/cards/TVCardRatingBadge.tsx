import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Colors, Fonts } from "../../theme/colors";

interface Props {
  /** Note globale /10. `null` ou `<= 0` : rien n'est rendu. */
  rating: number | null | undefined;
  /** Autre ancrage que le coin bas-gauche de l'affiche. */
  style?: StyleProp<ViewStyle>;
}

/**
 * La note d'une affiche du salon.
 *
 * Le jumeau des badges du web et du mobile, à une différence près : la taille.
 * Un téléviseur se lit à trois mètres, la note est donc en 13 plutôt qu'en 11,
 * et la pastille respire un peu plus. Tout le reste — la règle qui décide QUELLE
 * note poser — vit dans `@tentacle-tv/shared` et ne se recopie pas.
 *
 * Noir et blanc constants, étoile à l'accent de marque : posé sur une affiche,
 * rien ne suit le thème.
 */
export const TVCardRatingBadge = memo(function TVCardRatingBadge({ rating, style }: Props) {
  if (rating == null || rating <= 0) return null;

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.star}>★</Text>
      <Text style={styles.score}>{rating.toFixed(1)}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  star: { fontSize: 12, color: Colors.accentPink },
  score: { fontSize: 13, color: "#FFFFFF", fontFamily: Fonts.bold },
});
