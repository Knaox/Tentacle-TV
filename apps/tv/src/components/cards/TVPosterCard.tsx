import { memo } from "react";
import { View, Text } from "react-native";
import { useTranslation } from "react-i18next";
import LinearGradient from "react-native-linear-gradient";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { BRAND } from "@tentacle-tv/shared";
import { Colors, Typography, Fonts } from "../../theme/colors";
import { CheckIcon } from "../icons/TVIcons";
import { TVCardImage } from "./TVCardImage";
import { TVCardProgressBar } from "./TVCardProgressBar";
import { TVMetaChips } from "../TVMetaChips";
import { TV_POSTER_WIDTH, TV_CARD_RADIUS, type TVCardSize } from "./cardSizes";

const pad2 = (n: number) => String(n).padStart(2, "0");

interface TVPosterCardProps {
  item: MediaItem;
  size?: TVCardSize;
  /** Largeur explicite (grilles adaptatives) — prime sur `size`. */
  width?: number;
}

/**
 * Affiche 2:3 SEULE (image + badges + progress) — à wrapper par Focusable
 * dans les grilles pour que le ring de focus n'englobe pas les textes
 * (sinon il déborde sur la rangée suivante).
 */
export const TVPosterFrame = memo(function TVPosterFrame({ item, width, focused = false }: { item: MediaItem; width: number; focused?: boolean }) {
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const addedCount = item.RecentlyAddedCount ?? 0;
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 360, quality: 85 });
  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;

  return (
    <View
      style={{
        width,
        aspectRatio: 2 / 3,
        borderRadius: TV_CARD_RADIUS,
        overflow: "hidden",
        backgroundColor: Colors.bgCard,
      }}
    >
      <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />

      {/* Badge « +N » des groupes d'épisodes (gradient brand, comme le web) */}
      {addedCount > 1 && (
        <LinearGradient
          colors={[BRAND.violet, Colors.accentPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute", top: 8, left: 8,
            borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: Fonts.bold }}>+{addedCount}</Text>
        </LinearGradient>
      )}

      {watched && (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: Colors.textPrimary,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <CheckIcon size={12} color={Colors.bgDeep} />
        </View>
      )}

      {!watched && <TVCardProgressBar percent={progress} />}

      {/* Méta qualité/langues révélée AU FOCUS (équivalent du hover web
          CardMetaOverlay) — pas sur les tuiles groupées « +N » (comme web). */}
      {focused && addedCount <= 1 && (
        <View style={{ position: "absolute", left: 6, right: 6, bottom: 8 }}>
          <TVMetaChips item={item} compact />
        </View>
      )}
    </View>
  );
});

/** Titre + sous-titre sous l'affiche (aligné PosterCard web). */
export const TVPosterMeta = memo(function TVPosterMeta({ item, width }: { item: MediaItem; width: number }) {
  const { t } = useTranslation("common");
  const isEpisode = item.Type === "Episode";
  const addedCount = item.RecentlyAddedCount ?? 0;
  const epLabel = isEpisode && item.ParentIndexNumber != null && item.IndexNumber != null
    ? `S${pad2(item.ParentIndexNumber)}E${pad2(item.IndexNumber)}`
    : null;
  const subtitle = addedCount > 1
    ? t("addedEpisodes", { count: addedCount, defaultValue: "{{count}} épisodes ajoutés" })
    : isEpisode
      ? [epLabel, item.Name].filter(Boolean).join(" · ")
      : item.ProductionYear ? String(item.ProductionYear) : null;

  return (
    <View style={{ width }}>
      <Text
        numberOfLines={1}
        style={{ color: Colors.textSecondary, ...Typography.cardTitle, marginTop: 10 }}
      >
        {isEpisode ? (item.SeriesName ?? item.Name) : item.Name}
      </Text>
      {subtitle && (
        <Text numberOfLines={1} style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 2 }}>
          {subtitle}
        </Text>
      )}
    </View>
  );
});

/**
 * 2:3 portrait card — pure visual component (affiche + textes).
 * Caller wraps it with `<Focusable variant="card">` to get focus border + glow + scale.
 */
export const TVPosterCard = memo(function TVPosterCard({
  item,
  size = "md",
  width: widthOverride,
  focused = false,
}: TVPosterCardProps & { focused?: boolean }) {
  const width = widthOverride ?? TV_POSTER_WIDTH[size];
  return (
    <View style={{ width }}>
      <TVPosterFrame item={item} width={width} focused={focused} />
      <TVPosterMeta item={item} width={width} />
    </View>
  );
});
