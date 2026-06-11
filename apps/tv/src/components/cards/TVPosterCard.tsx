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
import { TV_POSTER_WIDTH, TV_CARD_RADIUS, type TVCardSize } from "./cardSizes";

const pad2 = (n: number) => String(n).padStart(2, "0");

interface TVPosterCardProps {
  item: MediaItem;
  size?: TVCardSize;
  /** Largeur explicite (grilles adaptatives) — prime sur `size`. */
  width?: number;
}

/**
 * 2:3 portrait card — pure visual component.
 * Caller wraps it with `<Focusable variant="card">` to get focus border + glow + scale.
 *
 * Replaces the legacy `<TVMediaCard variant="portrait" />` with:
 *  - Larger default width (180 vs 160) for better TV legibility at 3m
 *  - Brand violet progress bar (was orange)
 *  - Inverted watched check (white circle + dark check) for a brand-coherent look
 *  - Episode-aware fallback image (uses series ID when applicable)
 */
export const TVPosterCard = memo(function TVPosterCard({
  item,
  size = "md",
  width: widthOverride,
}: TVPosterCardProps) {
  const client = useJellyfinClient();
  const { t } = useTranslation("common");

  const isEpisode = item.Type === "Episode";
  // Tuile série groupée « Derniers ajouts » : N épisodes ajoutés d'un coup (web).
  const addedCount = item.RecentlyAddedCount ?? 0;
  const imageId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const imageUrl = client.getImageUrl(imageId, "Primary", { height: 360, quality: 85 });
  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage;
  const width = widthOverride ?? TV_POSTER_WIDTH[size];

  // Sous-titre aligné PosterCard web : « N épisodes ajoutés » / « S##E## · Titre » / année.
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
      </View>

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
