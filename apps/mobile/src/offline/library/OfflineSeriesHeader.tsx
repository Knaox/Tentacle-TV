import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import type { OfflineSeriesGroup } from "@tentacle-tv/offline-core";
import { MetaTokens } from "@/components/detail/MetaTokens";
import { useLocalArtworkUri } from "@/hooks/offline/useLocalSnapshot";
import type { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import type { OfflineEntry } from "@/offline/engineApi";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, RADIUS, useTheme, useThemedStyles } from "@/theme";
import type { OfflineDetailMetrics } from "./OfflineDetailShell";
import { SERIES_ART } from "./offlineArt";
import { OfflineLocalImage } from "./OfflineLocalImage";

interface Props {
  series: OfflineSeriesGroup;
  seriesItem: MediaItem;
  sampleItem: MediaItem | undefined;
  playTarget: OfflineEntry | null;
  playLabel: string | null;
  watchedAll: boolean;
  metrics: OfflineDetailMetrics;
  anims: ReturnType<typeof useMediaDetailAnimations>;
  onPlay: (entry: OfflineEntry) => void;
}

/**
 * Le bloc « hero » de la vue série locale — le jumeau de `DetailHeader` :
 * affiche du snapshot, LOGO sinon titre, méta (année · saisons · épisodes ·
 * note), jetons de qualité d'un épisode, et la pilule « Reprendre à 12:30 ·
 * S01E03 ». Portrait : affiche débordant la bannière ; paysage tablette :
 * empilé dans le rail gauche.
 */
export function OfflineSeriesHeader({ series, seriesItem, sampleItem, playTarget, playLabel, watchedAll, metrics, anims, onPlay }: Props) {
  const { t } = useTranslation(["common", "downloads"]);
  const theme = useTheme();
  const st = useThemedStyles(makeMediaDetailStyles);
  const logoUri = useLocalArtworkUri(series.posterItemId, "logo.png");
  const rating = seriesItem.CommunityRating?.toFixed(1);
  const { posterW, posterH, twoCol } = metrics;

  const posterEl = (
    <Animated.View style={[{ width: posterW, height: posterH }, anims.posterStyle]}>
      <View style={{ width: posterW, height: posterH, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: theme.colors.surface.s2, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 20 }}>
        <OfflineLocalImage itemId={series.posterItemId} candidates={SERIES_ART} style={StyleSheet.absoluteFill} />
      </View>
      {watchedAll && <View style={st.watchedRing}><Feather name="check" size={14} color={theme.colors.cta.primaryFg} /></View>}
    </Animated.View>
  );

  const metaEl = (
    <Animated.View style={anims.titleStyle}>
      {logoUri ? (
        <Image source={{ uri: logoUri }} style={{ width: 240, maxWidth: "100%", height: 72 }} contentFit="contain" contentPosition="left" cachePolicy="none" accessibilityLabel={series.seriesName} />
      ) : (
        <Text style={st.title} numberOfLines={3}>{series.seriesName}</Text>
      )}
      <Animated.View style={[st.metaRow, anims.metaStyle]}>
        {seriesItem.ProductionYear != null && <Text style={st.metaItem}>{seriesItem.ProductionYear}</Text>}
        {seriesItem.ProductionYear != null && <Text style={st.metaDot}>·</Text>}
        <Text style={st.metaItem}>{t("common:seasonsCount", { count: series.seasons.length })}</Text>
        <Text style={st.metaDot}>·</Text>
        <Text style={st.metaItem}>{t("downloads:episodesCount", { count: series.episodeCount })}</Text>
        {rating && <Text style={st.metaDot}>·</Text>}
        {rating && (
          <View style={st.ratingRow}><Feather name="star" size={11} color={theme.colors.status.rating} /><Text style={st.ratingTxt}>{rating}</Text></View>
        )}
      </Animated.View>
      <Animated.View style={anims.metaStyle}><MetaTokens item={sampleItem} /></Animated.View>
    </Animated.View>
  );

  const playEl = playTarget && playLabel ? (
    <Animated.View style={[{ marginTop: spacing.xl }, anims.actionsStyle]}>
      <View style={{ width: "100%", maxWidth: 420 }}>
        <Pressable style={({ pressed }) => [st.playBtn, pressed && { opacity: 0.85 }]} onPress={() => onPlay(playTarget)} accessibilityRole="button" accessibilityLabel={`${playLabel} ${series.seriesName}`}>
          <Feather name="play" size={20} color={theme.colors.cta.primaryFg} fill={theme.colors.cta.primaryFg} />
          <Text style={st.playBtnTxt} numberOfLines={1}>{playLabel}</Text>
        </Pressable>
      </View>
    </Animated.View>
  ) : null;

  if (twoCol) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        {posterEl}
        <View style={{ marginTop: spacing.md }}>{metaEl}</View>
        {playEl}
      </View>
    );
  }

  return (
    <>
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(posterH * 0.55) }}>
        {posterEl}
        <View style={{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end" }}>{metaEl}</View>
      </View>
      <View style={{ paddingHorizontal: spacing.screenPadding }}>{playEl}</View>
    </>
  );
}
