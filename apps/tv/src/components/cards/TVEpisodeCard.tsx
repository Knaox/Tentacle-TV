import { memo, useMemo } from "react";
import { View, Text } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { buildTrickplayTileUrl, useJellyfinClient } from "@tentacle-tv/api-client";
import { cardRatingFor, resolveBannerImage, resolveResumeSprite, ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { Colors, Typography } from "../../theme/colors";
import { TVCardImage } from "./TVCardImage";
import { TVCardTrickplayImage } from "./TVCardTrickplayImage";
import { TVCardProgressBar } from "./TVCardProgressBar";
import { TVCardMarkerLayer } from "./TVCardMarkerLayer";
import { TV_STATUS_PILL_MAX_WIDTH } from "./TVCardStatusMarkers";
import { TVMetaChips, hasMetaChips } from "../TVMetaChips";
import { TV_EPISODE_WIDTH, TV_CARD_RADIUS, type TVCardSize } from "./cardSizes";

interface TVEpisodeCardProps {
  item: MediaItem;
  size?: TVCardSize;
  /** Révèle les chips qualité/langues (équivalent hover web). */
  focused?: boolean;
}

/**
 * La vignette 16:9 SEULE des rangées « Reprendre » / « Prochains épisodes » :
 * la scène (ou la vignette exacte de la reprise), SxxExx, le titre de
 * l'épisode, la progression et les marqueurs. C'est elle que l'anneau de
 * focus entoure ; le nom de la série vit dessous (`TVEpisodeMeta`), hors de
 * l'anneau — comme l'affiche (`TVPosterFrame` / `TVPosterMeta`).
 */
export const TVEpisodeFrame = memo(function TVEpisodeFrame({
  item,
  size = "md",
  focused = false,
}: TVEpisodeCardProps) {
  const client = useJellyfinClient();
  const isEpisode = item.Type === "Episode";
  const width = TV_EPISODE_WIDTH[size];

  // Même chaîne de repli que le web (`cardImage.ts`, shared) : Primary
  // épisode → Backdrop épisode → Backdrop série → Primary série ; le tag
  // adresse l'URL par CONTENU (affiche remplacée → nouvelle URL) et `null`
  // prouve l'absence — TVCardImage rend alors son repli sans requête.
  const resolvedImage = resolveBannerImage(item);
  const imageUrl = resolvedImage
    ? client.getImageUrl(resolvedImage.id, resolvedImage.type, {
        width: 540,
        quality: 80,
        ...(resolvedImage.tag ? { tag: resolvedImage.tag } : {}),
      })
    : null;

  // La vignette EXACTE de la reprise (même math que web et bureau) — `null`
  // hors reprise, et la carte garde sa bannière. La bannière reste le repli
  // d'erreur si la planche ne charge pas.
  const positionTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const sprite = useMemo(
    () => resolveResumeSprite(item.Trickplay, positionTicks, item.MediaSources?.[0]?.Id),
    [item.Trickplay, positionTicks, item.MediaSources],
  );
  const frameUrl = sprite
    ? buildTrickplayTileUrl(
        client.getBaseUrl(),
        client.getAccessToken(),
        item.Id,
        sprite.selection.mediaSourceId,
        sprite.selection.width,
        sprite.tileIndex,
      )
    : null;

  const watched = item.UserData?.Played === true;
  const progress = item.UserData?.PlayedPercentage ?? 0;

  const epLabel = isEpisode && item.ParentIndexNumber != null && item.IndexNumber != null
    ? `S${String(item.ParentIndexNumber).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")}`
    : null;

  const remainingTicks = item.RunTimeTicks && progress > 0
    ? item.RunTimeTicks * (1 - progress / 100)
    : null;
  const remainingMin = remainingTicks ? Math.round(ticksToSeconds(remainingTicks) / 60) : null;
  // Les puces ne remplacent la note que si elles existent (un épisode de la
  // recherche ne porte pas ses flux) : sinon la note reste, focus ou non.
  const chipsShown = focused && hasMetaChips(item, true);

  return (
    <View
      style={{
        width,
        aspectRatio: 16 / 9,
        borderRadius: TV_CARD_RADIUS,
        overflow: "hidden",
        backgroundColor: Colors.bgCard,
      }}
    >
      {sprite && frameUrl ? (
        <TVCardTrickplayImage
          url={frameUrl}
          info={sprite.selection.info}
          col={sprite.col}
          row={sprite.row}
          cardWidth={width}
          fallback={<TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />}
        />
      ) : (
        <TVCardImage uri={imageUrl} style={{ width: "100%", height: "100%" }} />
      )}

      {/* La note de CET épisode — la vignette porte son nom et son numéro.
          En haut-gauche, où les chips prennent sa place au focus ; le bas est
          tenu par le titre. La pastille d'états tient le haut-droit, sous le
          temps restant quand il y en a un. */}
      <TVCardMarkerLayer
        item={item}
        communityRating={cardRatingFor(item, "item").rating}
        scope="item"
        hideRating={chipsShown}
        ratingStyle={RATING_TOP_LEFT}
        statusStyle={remainingMin != null && remainingMin > 0 ? STATUS_BELOW_TIME : undefined}
      />

      {/* Chips qualité/langues AU FOCUS (haut-gauche), comme le hover
          desktop. Leur bord droit s'arrête avant la PLUS LARGE occupation du
          coin opposé — la pastille d'états pleine, que le temps restant
          déplace dessous : même repliées sur deux lignes, elles ne la
          croisent jamais. */}
      {chipsShown && (
        <View style={{ position: "absolute", left: 8, top: 8, right: CHIPS_RIGHT }}>
          <TVMetaChips item={item} compact />
        </View>
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        locations={[0.35, 1]}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "65%",
        }}
      />

      {/* Episode label + title overlay */}
      <View
        style={{
          position: "absolute",
          bottom: 10,
          left: 12,
          right: 12,
        }}
      >
        {epLabel && (
          <Text
            style={{
              color: Colors.textSecondary,
              fontSize: 12,
              fontWeight: "700",
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            {epLabel}
          </Text>
        )}
        <Text
          numberOfLines={1}
          style={{
            color: Colors.textPrimary,
            fontSize: 15,
            fontWeight: "600",
          }}
        >
          {item.Name}
        </Text>
      </View>

      {remainingMin != null && remainingMin > 0 && (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            backgroundColor: "rgba(0,0,0,0.6)",
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 4,
          }}
        >
          <Text style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
            {remainingMin} min
          </Text>
        </View>
      )}

      {!watched && <TVCardProgressBar percent={progress} />}
    </View>
  );
});

/** Le nom de la série, sous la vignette — hors de l'anneau de focus. */
export const TVEpisodeMeta = memo(function TVEpisodeMeta({ item, size = "md" }: { item: MediaItem; size?: TVCardSize }) {
  if (!item.SeriesName) return null;
  return (
    <Text
      numberOfLines={1}
      style={{ width: TV_EPISODE_WIDTH[size], color: Colors.textTertiary, ...Typography.caption, marginTop: 8 }}
    >
      {item.SeriesName}
    </Text>
  );
});

const RATING_TOP_LEFT = { left: 8, top: 8, bottom: undefined } as const;
/** Le retrait droit des puces : la pastille d'états pleine et son air. */
const CHIPS_RIGHT = 8 + TV_STATUS_PILL_MAX_WIDTH + 8;
/** Sous la pastille « N min » (haut-droit) : 8 + ~22 de haut + 10 d’air. */
const STATUS_BELOW_TIME = { top: 40 } as const;
