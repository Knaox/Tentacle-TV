import { useCallback, useMemo } from "react";
import { Animated, FlatList, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../../player/chrome/useChromeInsets";
import { openingEpisodeIndex, type EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { shelfGeometry } from "../../../../player/episodes/episodeBrowserLayout";
import { BrowserCloseButton } from "../BrowserCloseButton";
import { EB } from "../browserTokens";
import type { EpisodeBrowserProps } from "../types";
import { useEntrance, useSeasonSwap } from "../useBrowserMotion";
import { useEpisodeWords } from "../useEpisodeWords";
import { ShelfCard } from "./ShelfCard";
import { ShelfSeasonTabs } from "./ShelfSeasonTabs";

const GAP = 14;
/** Le voile commence au-dessus de l'étagère : le texte des onglets n'est jamais sur l'image nue. */
const SCRIM_LEAD = 96;

/**
 * Piste A — l'étagère. L'image reste reine : aucune plaque, un voile qui monte
 * du bas, les saisons en mots, puis les épisodes en grandes cartes 16:9 qui
 * défilent de côté et s'arrêtent carte par carte. Debout, l'étagère se pose
 * dans le noir sous l'image, qui reste entière. Toucher l'image ferme.
 */
export function ShelfBrowser(props: EpisodeBrowserProps) {
  const { seriesTitle, seasons, activeSeasonId, onSelectSeason, onSeasonIntent, episodes, loading, renderArtwork, onPlay, onClose, video } = props;
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const safe = useSafeAreaInsets();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const geo = shelfGeometry({ width, height, isTablet, edges, safe }, video);
  const words = useEpisodeWords();
  const enter = useEntrance();
  const swap = useSeasonSwap(activeSeasonId);
  const lift = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });

  const step = geo.cardWidth + GAP;
  const visible = (width - geo.inset) / step;
  // L'épisode d'avant reste en vue quand l'étagère en montre trois ou plus : on sait où l'on est.
  const opening = useMemo(() => {
    const index = openingEpisodeIndex(episodes);
    return visible >= 3 ? Math.max(0, index - 1) : index;
  }, [episodes, visible]);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: step, offset: step * index, index }), [step]);
  const renderItem = useCallback(({ item }: { item: EpisodeEntry }) => (
    <ShelfCard
      entry={item}
      width={geo.cardWidth}
      overviewLines={geo.overviewLines}
      large={isTablet}
      artwork={renderArtwork(item)}
      words={words}
      onPlay={onPlay}
    />
  ), [geo.cardWidth, geo.overviewLines, isTablet, renderArtwork, words, onPlay]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
      <Animated.View pointerEvents="none" style={[st.scrim, { top: geo.belowVideo ? video.y + video.height : geo.top - SCRIM_LEAD, opacity: enter }]}>
        {geo.belowVideo ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: EB.scrim(0.6) }]} />
        ) : (
          <LinearGradient colors={[EB.scrim(0), EB.scrim(0.62), EB.scrim(0.88)]} locations={[0, 0.34, 1]} style={StyleSheet.absoluteFill} />
        )}
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[st.body, { top: geo.top, opacity: enter, transform: [{ translateY: lift }] }]}>
        <View style={[st.header, { paddingLeft: geo.inset, paddingRight: geo.inset - 4, height: isTablet ? 46 : 40 }]}>
          <ShelfSeasonTabs
            seasons={seasons}
            activeId={activeSeasonId}
            onSelect={onSelectSeason}
            onIntent={onSeasonIntent}
            fallbackTitle={seriesTitle}
            large={isTablet}
          />
          <View style={st.spacer} />
          <BrowserCloseButton onPress={onClose} size={isTablet ? 34 : 30} />
        </View>
        <Animated.View style={{ opacity: swap.opacity, transform: [{ translateX: swap.translate }] }}>
          {loading ? (
            <View style={[st.ghosts, { paddingLeft: geo.inset }]}>
              {[0, 1, 2, 3].map((i) => <View key={i} style={[st.ghost, { width: geo.cardWidth, height: geo.thumbHeight, borderRadius: isTablet ? 14 : 12 }]} />)}
            </View>
          ) : (
            <FlatList
              key={activeSeasonId}
              data={episodes as EpisodeEntry[]}
              keyExtractor={(entry) => entry.id}
              renderItem={renderItem}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={step}
              decelerationRate="fast"
              getItemLayout={getItemLayout}
              initialScrollIndex={opening > 0 ? opening : undefined}
              initialNumToRender={6}
              windowSize={5}
              contentContainerStyle={{ paddingLeft: geo.inset, paddingRight: geo.inset, gap: GAP, paddingTop: 12 }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  body: { position: "absolute", left: 0, right: 0 },
  header: { flexDirection: "row", alignItems: "center" },
  spacer: { flex: 1, minWidth: 12 },
  ghosts: { flexDirection: "row", gap: GAP, paddingTop: 12, overflow: "hidden" },
  ghost: { backgroundColor: EB.fill },
});
