import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { EndCardRating } from "@tentacle-tv/api-client";
import { StarRatingMobile } from "../rating/StarRatingMobile";

interface Props {
  rating: EndCardRating;
  /** Appelé quand une note se pose : tue le décompte de la suite. */
  onRatingEngage?: () => void;
}

/**
 * Noter l'épisode FINI, sous les actions de l'affiche de fin — geste
 * secondaire : poser une étoile tue le décompte, la surface reste une
 * proposition. Extrait de `NextEpisodeFullscreenMobile` (règle des 300 lignes).
 */
export function EndCardRatingBlock({ rating, onRatingEngage }: Props) {
  const { t } = useTranslation("player");
  const { t: tReco } = useTranslation("reco");
  return (
    <View style={st.ratingBlock}>
      <Text style={st.rateLabel}>
        {t("rateJustWatched")}
        {rating.episodeCode ? ` — ${rating.episodeCode}` : ""}
      </Text>
      <View style={st.ratingRow}>
        <StarRatingMobile
          value={rating.value}
          onRate={(score) => {
            onRatingEngage?.();
            rating.rate(score);
          }}
          onClear={() => {
            onRatingEngage?.();
            rating.clear();
          }}
        />
        {rating.value != null && (
          <Text style={st.rateValue}>{tReco("ratingValue", { score: rating.value })}</Text>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  ratingBlock: { marginTop: 18 },
  rateLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowRadius: 4,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  rateValue: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
