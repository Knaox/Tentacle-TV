import { memo } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { BRAND } from "@tentacle-tv/shared";
import { Colors, Typography, Fonts } from "../../theme/colors";
import { TVCardImage } from "./TVCardImage";
import { TV_POSTER_WIDTH, TV_CARD_RADIUS } from "./cardSizes";

interface TVRecoCardProps {
  item: RecoRowItem;
  focused?: boolean;
  width?: number;
}

/**
 * Une carte de recommandation (2:3) : l'affiche Jellyfin du titre — sur le
 * téléviseur, seules les recommandations EN bibliothèque s'affichent —, un
 * badge « Découverte » pour une exploration (gradient de marque, comme le
 * « +N » de TVPosterFrame), la note globale, puis titre et année sous
 * l'affiche (mêmes styles que TVPosterMeta). Au focus, la première raison.
 */
export const TVRecoCard = memo(function TVRecoCard({ item, focused = false, width = TV_POSTER_WIDTH.md }: TVRecoCardProps) {
  const { t } = useTranslation("reco");
  const client = useJellyfinClient();
  const imageUrl = item.jellyfinItemId
    ? client.getImageUrl(item.jellyfinItemId, "Primary", { height: 360, quality: 85 })
    : null;
  const reason = item.reasons[0]?.label ?? null;

  return (
    <View style={{ width }}>
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
        {item.voteAverage != null && item.voteAverage > 0 && (
          <View style={{ position: "absolute", bottom: 8, right: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: "rgba(0,0,0,0.65)" }}>
            <Text style={{ color: Colors.textPrimary, fontSize: 12, fontFamily: Fonts.bold }}>★ {item.voteAverage.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 10 }}>
        {item.title}
      </Text>
      <Text numberOfLines={1} style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 2 }}>
        {focused && reason ? reason : item.year != null ? String(item.year) : ""}
      </Text>
    </View>
  );
});
