import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { SwipeCard } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme } from "@/theme";

interface Props {
  card: SwipeCard;
  title: string;
  format: string;
}

const SCRIM = ["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"] as const;

/**
 * Le texte du recto, posé sur l'affiche (blanc/noir constants) : l'origine
 * de la carte et sa note en haut ; en bas, sur un dégradé, le titre, le
 * format, les genres, la présence en bibliothèque et la raison.
 */
export function SwipeCardRectoNative({ card, title, format }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  return (
    <>
      <View style={st.topRow} pointerEvents="none">
        {card.source !== "taste" ? (
          <View style={st.chip}>
            <Feather name={card.source === "popular" ? "trending-up" : "compass"} size={12} color="#fff" />
            <Text style={st.chipText}>{card.source === "popular" ? t("sourcePopular") : t("sourceExplore")}</Text>
          </View>
        ) : <View />}
        {card.voteAverage != null && card.voteAverage > 0 && (
          <View style={st.chip}>
            <Feather name="star" size={12} color={theme.colors.status.rating} />
            <Text style={st.chipText}>{card.voteAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <LinearGradient colors={SCRIM} locations={[0, 0.45, 1]} style={st.bottom} pointerEvents="none">
        <Text style={st.title} numberOfLines={2}>{title}</Text>
        {!!format && <Text style={st.format}>{format}</Text>}
        {card.genres.length > 0 && (
          <View style={st.genres}>
            {card.genres.map((g) => (
              <View key={g} style={st.genre}><Text style={st.genreText}>{g}</Text></View>
            ))}
          </View>
        )}
        <View style={st.metaLine}>
          <Feather name={card.jellyfinItemId ? "check" : "circle"} size={12} color="rgba(255,255,255,0.85)" />
          <Text style={st.meta}>{card.jellyfinItemId ? t("inLibrary") : t("notInLibrary")}</Text>
        </View>
        {card.reason && (
          <View style={st.metaLine}>
            <Feather name="zap" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={st.meta} numberOfLines={1}>{t("reason", { title: card.reason })}</Text>
          </View>
        )}
      </LinearGradient>
    </>
  );
}

const st = StyleSheet.create({
  topRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.65)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.3)" },
  chipText: { color: "#fff", fontSize: 12, fontFamily: FONT_FAMILY.semibold, fontWeight: "600" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingBottom: 18, paddingTop: 72 },
  title: { ...typography.title, color: "#fff" },
  format: { ...typography.caption, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  genre: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.25)" },
  genreText: { color: "#fff", fontSize: 12, fontFamily: FONT_FAMILY.medium, fontWeight: "500" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  meta: { flexShrink: 1, color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: FONT_FAMILY.medium, fontWeight: "500" },
});
