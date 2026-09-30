import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { RatingStars } from "../../rating/RatingStars";
import { colors, fonts } from "../../theme/tokens";
import type { CardTrayRating } from "../cardTypes";

/**
 * La note perso au plateau : ses étoiles, demi-étoiles comprises, et « 8/10 ».
 * Un AFFICHAGE, jamais une cible : sur Apple TV, une note se pose sur
 * l'échelle verticale de la feuille (l'appui long) — une seule saisie, aux
 * valeurs du bureau. Rien sans note posée, ni tant que sa cible se résout.
 */
export const TrayNote = memo(function TrayNote({ rating, size }: { rating: CardTrayRating; size: number }) {
  const { t } = useTranslation("reco");
  if (rating.pending || rating.current === null) return null;
  return (
    <View style={styles.row} accessibilityLabel={t("ratingValue", { score: rating.current })}>
      <RatingStars score={rating.current} size={size} gap={3} />
      <Text style={styles.value}>{t("ratingValue", { score: rating.current })}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  value: { ...fonts.bold, fontSize: 22, color: colors.text, fontVariant: ["tabular-nums"] },
});
