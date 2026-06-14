import { memo, useCallback, useState, type ElementRef } from "react";
import { View, Text, Image, Dimensions, TVFocusGuideView } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useSeriesWatchState } from "@tentacle-tv/api-client";
import { formatDuration } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { BRAND } from "@tentacle-tv/shared";
import { Colors, Spacing, Typography, Radius } from "../../theme/colors";
import { Focusable } from "../focus/Focusable";
import { PlayIcon } from "../icons/TVIcons";
import { TVMetaChips } from "../TVMetaChips";

const pad2 = (n: number) => String(n).padStart(2, "0");

const { width: SCREEN_W } = Dimensions.get("window");

interface TVHeroContentProps {
  item: MediaItem;
  onPlay: (item: MediaItem) => void;
  onDetail: (item: MediaItem) => void;
  onButtonFocus?: () => void;
  onButtonBlur?: () => void;
}

/**
 * Hero text + CTAs.
 * Uses Jellyfin Logo image when available (falls back to title text).
 * White Play button (matches web), translucent violet ghost for "Plus d'infos".
 */
export const TVHeroContent = memo(function TVHeroContent({
  item,
  onPlay,
  onDetail,
  onButtonFocus,
  onButtonBlur,
}: TVHeroContentProps) {
  const { t } = useTranslation("common");
  const client = useJellyfinClient();
  // Node du bouton « Reprendre » : destination du focus entrant dans le hero
  // (UP depuis le carrousel doit cibler Reprendre, pas « Plus d'infos »).
  // Callback ref via state → re-render quand le bouton est monté.
  const [playBtn, setPlayBtn] = useState<ElementRef<typeof Focusable> | null>(null);
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  // Série mise en avant : résoudre l'épisode à lire (parité HeroContent web) —
  // jamais l'ID série au Player ; série terminée → fiche média.
  const { data: watchState } = useSeriesWatchState(isSeries ? item.Id : undefined);
  const handlePlay = useCallback(() => {
    if (isSeries) {
      const ep = watchState && watchState.type !== "completed" ? watchState.episode : undefined;
      if (ep) onPlay(ep);
      else onDetail(item);
      return;
    }
    onPlay(item);
  }, [isSeries, watchState, item, onPlay, onDetail]);
  const logoId = isEpisode && item.SeriesId ? item.SeriesId : item.Id;
  const hasLogo = item.ImageTags?.Logo != null
    || (isEpisode && item.SeriesId != null);
  const logoUri = hasLogo
    ? client.getImageUrl(logoId, "Logo", { width: 460, quality: 90 })
    : null;

  const displayName = isEpisode ? (item.SeriesName ?? item.Name) : item.Name;
  const tagline = item.Taglines?.[0];
  const year = item.ProductionYear;
  const genres = item.Genres?.slice(0, 3) ?? [];
  const runtime = item.RunTimeTicks ? formatDuration(item.RunTimeTicks) : null;
  const rating = item.CommunityRating?.toFixed(1);

  // Reprise de visionnage (hero web) : progress + libellé « Reprendre »
  const progressPct = item.UserData?.PlayedPercentage ?? 0;
  const hasProgress = progressPct > 0 && progressPct < 100;
  // Label « S##E## · Titre épisode » (hero web)
  const epLabel = isEpisode && item.ParentIndexNumber != null && item.IndexNumber != null
    ? [`S${pad2(item.ParentIndexNumber)}E${pad2(item.IndexNumber)}`, item.Name].filter(Boolean).join(" · ")
    : null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 56,
        left: Spacing.screenPadding,
        right: SCREEN_W * 0.42,
      }}
    >
      {logoUri ? (
        <Image
          source={{ uri: logoUri }}
          style={{ height: 88, width: 360, marginBottom: 12 }}
          resizeMode="contain"
        />
      ) : (
        <Text
          numberOfLines={2}
          style={{
            color: Colors.textPrimary,
            ...Typography.heroTitle,
            textShadowColor: "rgba(0,0,0,0.8)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 6,
          }}
        >
          {displayName}
        </Text>
      )}

      {/* Épisode en reprise : « S02E05 · Titre » (hero web) */}
      {epLabel && (
        <Text numberOfLines={1} style={{ color: Colors.textSecondary, ...Typography.meta, marginTop: 4 }}>
          {epLabel}
        </Text>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: Spacing.titleToMeta,
        }}
      >
        {year && <Text style={{ color: Colors.textSecondary, ...Typography.meta }}>{year}</Text>}
        {rating && (
          <>
            <Text style={{ color: Colors.textTertiary }}>·</Text>
            <Text style={{ color: Colors.ratingGold, ...Typography.meta }}>★ {rating}</Text>
          </>
        )}
        {runtime && (
          <>
            <Text style={{ color: Colors.textTertiary }}>·</Text>
            <Text style={{ color: Colors.textMuted, ...Typography.meta }}>{runtime}</Text>
          </>
        )}
        {genres.length > 0 && (
          <>
            <Text style={{ color: Colors.textTertiary }}>·</Text>
            <Text style={{ color: Colors.textMuted, ...Typography.meta }}>
              {genres.join(" · ")}
            </Text>
          </>
        )}
      </View>

      {/* Chips qualité/langues (4K · HDR · Atmos · VF…) — hero web */}
      {!isEpisode && (
        <View style={{ marginTop: 10 }}>
          <TVMetaChips item={item} />
        </View>
      )}

      {/* Barre de progression de reprise (hero web) */}
      {hasProgress && (
        <View style={{
          marginTop: 12, width: 300, height: 4, borderRadius: 2,
          backgroundColor: "rgba(255,255,255,0.18)", overflow: "hidden",
        }}>
          <View style={{
            width: `${Math.min(100, Math.max(2, progressPct))}%`, height: "100%",
            backgroundColor: Colors.accentPurple, borderRadius: 2,
          }} />
        </View>
      )}

      {tagline && (
        <Text
          numberOfLines={1}
          style={{
            color: Colors.textTertiary,
            ...Typography.tagline,
            marginTop: 10,
          }}
        >
          « {tagline} »
        </Text>
      )}

      {item.Overview && !tagline && (
        <Text
          numberOfLines={2}
          style={{
            color: Colors.textSecondary,
            ...Typography.synopsis,
            lineHeight: 22,
            marginTop: Spacing.metaToSynopsis,
          }}
        >
          {item.Overview}
        </Text>
      )}

      {/* @ts-ignore — TVFocusGuideView (react-native-tvos) : redirige le focus
          ENTRANT (UP depuis le carrousel) vers le bouton « Reprendre ». */}
      <TVFocusGuideView
        autoFocus
        destinations={playBtn ? [playBtn] : undefined}
        style={{
          flexDirection: "row",
          gap: Spacing.buttonGap,
          marginTop: Spacing.synopsisToButtons,
        }}
      >
        <Focusable
          ref={setPlayBtn}
          variant="button"
          onPress={handlePlay}
          hasTVPreferredFocus
          onFocus={onButtonFocus}
          onBlur={onButtonBlur}
          accessibilityLabel={t("play")}
        >
          <View
            style={{
              backgroundColor: Colors.textPrimary,
              paddingHorizontal: 26,
              paddingVertical: 12,
              borderRadius: Radius.buttonLarge,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <PlayIcon size={14} color={Colors.bgDeep} />
            <Text
              style={{
                color: Colors.bgDeep,
                ...Typography.buttonLarge,
              }}
            >
              {hasProgress ? t("resume", { defaultValue: "Reprendre" }) : t("play")}
            </Text>
          </View>
        </Focusable>

        <Focusable
          variant="button"
          onPress={() => onDetail(item)}
          onFocus={onButtonFocus}
          onBlur={onButtonBlur}
          accessibilityLabel={t("moreInfo")}
        >
          <View
            style={{
              backgroundColor: BRAND.ghost,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: Radius.buttonLarge,
              borderWidth: 1,
              borderColor: "rgba(139, 92, 246, 0.45)",
            }}
          >
            <Text style={{ color: Colors.textPrimary, ...Typography.buttonLarge }}>
              {t("moreInfo")}
            </Text>
          </View>
        </Focusable>
      </TVFocusGuideView>
    </View>
  );
});
