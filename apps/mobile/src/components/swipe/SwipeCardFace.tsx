import { memo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { SwipeCard, SwipeCardDetails } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { SwipeCardRectoNative } from "./SwipeCardRectoNative";

interface Props {
  card: SwipeCard;
  posterUri: string | null;
  /** Carte du dessus : elle seule montre son verso. */
  interactive: boolean;
  infoOpen: boolean;
  details: SwipeCardDetails | undefined;
}

/**
 * Une carte : l'affiche plein cadre, son texte (SwipeCardRectoNative) et, à
 * la demande, son verso — le synopsis, sur un voile quasi opaque. Même
 * contenu que la carte du web.
 */
export const SwipeCardFace = memo(function SwipeCardFace({ card, posterUri, interactive, infoOpen, details }: Props) {
  const { t } = useTranslation("swipe");
  const theme = useTheme();
  const [broken, setBroken] = useState(false);
  const title = details?.title || card.title;
  const format = [
    card.mediaType === "movie" ? t("movie") : t("series"),
    card.year ? String(card.year) : null,
    details?.runtimeMinutes ? t("runtime", { minutes: details.runtimeMinutes }) : null,
    details?.seasons ? t("seasons", { count: details.seasons }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <View style={[st.card, { backgroundColor: theme.colors.surface.s2 }]}>
      {posterUri && !broken ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} onError={() => setBroken(true)} />
      ) : (
        <LinearGradient colors={[theme.colors.brand.violet, theme.colors.brand.accent]} style={[StyleSheet.absoluteFill, st.fallback]}>
          <Text style={st.fallbackTitle}>{title}</Text>
        </LinearGradient>
      )}

      {/* Verso ouvert : le texte du recto s'efface — sous le voile, il
          transparaissait en fantôme. L'affiche seule reste dessous. */}
      {!(interactive && infoOpen) && <SwipeCardRectoNative card={card} title={title} format={format} />}

      {interactive && infoOpen && (
        <View style={st.info}>
          <Text style={st.infoTitle}>{title}</Text>
          {!!format && <Text style={st.format}>{format}</Text>}
          <ScrollView style={st.infoScroll} contentContainerStyle={{ paddingBottom: 12 }}>
            <Text style={st.overview}>
              {details === undefined ? "…" : details.overview || t("noOverview")}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  card: { flex: 1, borderRadius: 26, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)" },
  fallback: { alignItems: "center", justifyContent: "center", padding: 24 },
  fallbackTitle: { ...typography.title, color: "#fff", textAlign: "center" },
  format: { ...typography.caption, color: "rgba(255,255,255,0.8)", marginTop: 3 },
  info: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.9)", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  infoTitle: { ...typography.subtitle, color: "#fff" },
  infoScroll: { marginTop: 14, flex: 1 },
  overview: { ...typography.body, color: "rgba(255,255,255,0.92)", lineHeight: 22 },
});
