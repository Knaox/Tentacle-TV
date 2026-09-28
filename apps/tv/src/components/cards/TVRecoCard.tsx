import { memo } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient, useRecoMarkerItem } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { BRAND } from "@tentacle-tv/shared";
import { Colors, Typography, Fonts } from "../../theme/colors";
import { TVCardMarkerLayer } from "./TVCardMarkerLayer";
import { TVCardImage } from "./TVCardImage";
import { TV_POSTER_WIDTH, TV_CARD_RADIUS } from "./cardSizes";

interface TVRecoCardProps {
  item: RecoRowItem;
  focused?: boolean;
  width?: number;
}

/** L'affiche SEULE — ce que l'anneau de focus entoure dans une rangée. */
export const TVRecoFrame = memo(function TVRecoFrame({ item, width = TV_POSTER_WIDTH.md }: Omit<TVRecoCardProps, "focused">) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const face = useRecoMarkerItem(item);
  const imageUrl = item.jellyfinItemId
    ? client.getImageUrl(item.jellyfinItemId, "Primary", { height: 360, quality: 85 })
    : null;

  return (
    <View style={{ width, aspectRatio: 2 / 3, borderRadius: TV_CARD_RADIUS, overflow: "hidden", backgroundColor: Colors.bgCard }}>
      <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />
      {item.exploration && (
        <LinearGradient
          colors={[BRAND.violet, Colors.accentPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 8, left: 8, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: Fonts.bold }}>{t("explorationBadge")}</Text>
        </LinearGradient>
      )}
      {/* Les marqueurs communs, à leurs coins : « Découverte » tient le HAUT
          gauche, la note le bas gauche — ils ne se croisent pas. */}
      <TVCardMarkerLayer item={face} communityRating={item.voteAverage} />
    </View>
  );
});

/** Titre et année sous l'affiche — la première raison au focus. */
export const TVRecoMeta = memo(function TVRecoMeta({ item, focused = false, width = TV_POSTER_WIDTH.md }: TVRecoCardProps) {
  const reason = item.reasons[0]?.label ?? null;
  return (
    <View style={{ width }}>
      <Text numberOfLines={1} style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 10 }}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 2 }}>
        {focused && reason ? reason : item.year != null ? String(item.year) : ""}
      </Text>
    </View>
  );
});

/**
 * Une carte de recommandation (2:3) : l'affiche Jellyfin du titre — sur le
 * téléviseur, seules les recommandations EN bibliothèque s'affichent —, un
 * badge « Découverte » pour une exploration (gradient de marque, comme le
 * « +N » de TVPosterFrame), les marqueurs du modèle commun, puis titre et
 * année sous l'affiche (mêmes styles que TVPosterMeta). Au focus, la
 * première raison.
 *
 * Les marqueurs sont ceux de TOUTES les cartes (`TVCardMarkerLayer`) : la
 * note — globale et la vôtre — en bas à gauche, la pastille d'états en haut
 * à droite. Leur visage vient de `useRecoMarkerItem`, comme sur le web et le
 * mobile : une note posée depuis la feuille d'actions, un ajout à Ma liste,
 * s'y lisent sans attendre la prochaine page du moteur.
 */
export const TVRecoCard = memo(function TVRecoCard({ item, focused = false, width = TV_POSTER_WIDTH.md }: TVRecoCardProps) {
  return (
    <View style={{ width }}>
      <TVRecoFrame item={item} width={width} />
      <TVRecoMeta item={item} focused={focused} width={width} />
    </View>
  );
});
