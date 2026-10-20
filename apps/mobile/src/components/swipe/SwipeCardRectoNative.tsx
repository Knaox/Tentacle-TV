import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import type { SwipeCard } from "@tentacle-tv/api-client";
import { FONT_FAMILY, typography, useTheme } from "@/theme";
import { useSwipeCardLarge } from "./swipeCardScale";

interface Props {
  card: SwipeCard;
  title: string;
  format: string;
  /** Garder sous le texte la rangée du bouton de la fiche (cf. SwipeCardView). */
  pageSlot?: boolean;
}

const SCRIM = ["transparent", "rgba(0,0,0,0.6)", "rgba(0,0,0,0.92)"] as const;

/**
 * Le texte du recto, posé sur l'affiche (blanc/noir constants) : l'origine
 * de la carte et sa note en haut ; en bas, sur un dégradé, le titre, le
 * format, les genres, la présence en bibliothèque et la raison. Sur une
 * grande carte (iPad), tout le texte grandit d'un tiers (`useSwipeCardLarge`).
 */
export function SwipeCardRectoNative({ card, title, format, pageSlot = false }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const L = useSwipeCardLarge() ? lg : null;
  const icon = L ? 16 : 12;
  return (
    <>
      <View style={[st.topRow, L?.topRow]} pointerEvents="none">
        {card.source !== "taste" ? (
          <View style={[st.chip, L?.chip]}>
            <Feather name={card.source === "popular" ? "trending-up" : "compass"} size={icon} color="#fff" />
            <Text style={[st.chipText, L?.text]}>{card.source === "popular" ? t("sourcePopular") : t("sourceExplore")}</Text>
          </View>
        ) : <View />}
        {card.voteAverage != null && card.voteAverage > 0 && (
          <View style={[st.chip, L?.chip]}>
            <Feather name="star" size={icon} color={theme.colors.status.rating} />
            <Text style={[st.chipText, L?.text]}>{card.voteAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <LinearGradient colors={SCRIM} locations={[0, 0.45, 1]} style={[st.bottom, L?.bottom, pageSlot && st.bottomWithPage]} pointerEvents="none">
        <Text style={[st.title, L?.title]} numberOfLines={2}>{title}</Text>
        {!!format && <Text style={[st.format, L?.format]}>{format}</Text>}
        {card.genres.length > 0 && (
          <View style={st.genres}>
            {card.genres.map((g) => (
              <View key={g} style={[st.genre, L?.genre]}><Text style={[st.genreText, L?.text]}>{g}</Text></View>
            ))}
          </View>
        )}
        <View style={[st.metaLine, L?.metaLine]}>
          <Feather name={card.jellyfinItemId ? "check" : "circle"} size={icon} color="rgba(255,255,255,0.85)" />
          <Text style={[st.meta, L?.text]}>{card.jellyfinItemId ? t("inLibrary") : t("notInLibrary")}</Text>
        </View>
        {card.reason && (
          <View style={[st.metaLine, L?.metaLine]}>
            <Feather name="zap" size={icon} color="rgba(255,255,255,0.85)" />
            <Text style={[st.meta, L?.text]} numberOfLines={1}>{t("reason", { title: card.reason })}</Text>
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
  bottomWithPage: { paddingBottom: 68 },
  title: { ...typography.title, color: "#fff" },
  format: { ...typography.caption, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  genres: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  genre: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.25)" },
  genreText: { color: "#fff", fontSize: 12, fontFamily: FONT_FAMILY.medium, fontWeight: "500" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  meta: { flexShrink: 1, color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: FONT_FAMILY.medium, fontWeight: "500" },
});

// La grande carte (iPad) : un tiers de plus, marges comprises.
const lg = StyleSheet.create({
  topRow: { top: 16, left: 16, right: 16 },
  chip: { gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  text: { fontSize: 15 },
  bottom: { paddingHorizontal: 26, paddingBottom: 26, paddingTop: 96 },
  title: { fontSize: 30 },
  format: { fontSize: 16, marginTop: 4 },
  genre: { paddingHorizontal: 12, paddingVertical: 5 },
  metaLine: { gap: 8, marginTop: 10 },
});
