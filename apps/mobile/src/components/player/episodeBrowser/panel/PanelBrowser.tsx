import { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../../player/chrome/useChromeInsets";
import { openingEpisodeIndex, type EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { panelGeometry } from "../../../../player/episodes/episodeBrowserLayout";
import { BrowserCloseButton } from "../BrowserCloseButton";
import { BrowserGlass } from "../BrowserGlass";
import { EB, EB_TYPE } from "../browserTokens";
import type { EpisodeBrowserProps } from "../types";
import { useBackCloses, useEntrance, useSeasonSwap } from "../useBrowserMotion";
import { useEpisodeWords } from "../useEpisodeWords";
import { PANEL_ROW_HEIGHT, PanelRow } from "./PanelRow";
import { SeasonChips } from "./SeasonChips";

const ROW_GAP = 4;

/**
 * Piste B — le panneau, celui du lecteur de la TV : une colonne de verre à
 * droite, l'image visible à gauche sous un voile léger ; l'en-tête
 * (« Épisodes », la série), les saisons en pastilles, puis les grandes lignes
 * d'épisode, ouvertes sur l'épisode en cours. Debout, l'image monte sous la
 * barre d'état et le panneau devient la feuille du dessous : rien ne la cache.
 */
export function PanelBrowser(props: EpisodeBrowserProps) {
  const { seriesTitle, seasons, activeSeasonId, onSelectSeason, onSeasonIntent, episodes, loading, renderArtwork, onPlay, onClose, video, onVideoLift } = props;
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const safe = useSafeAreaInsets();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const geo = panelGeometry({ width, height, isTablet, edges, safe }, video);
  const side = geo.mode === "side";
  const words = useEpisodeWords();
  const enter = useEntrance();
  useBackCloses(onClose);
  const swap = useSeasonSwap(activeSeasonId);
  const slide = enter.interpolate({ inputRange: [0, 1], outputRange: side ? [40, 0] : [height * 0.25, 0] });

  // Debout : l'image remonte pendant que la feuille arrive, et redescend à la fermeture.
  useEffect(() => {
    onVideoLift?.(geo.videoLift);
    return () => onVideoLift?.(0);
  }, [geo.videoLift, onVideoLift]);

  const rowHeight = (isTablet ? PANEL_ROW_HEIGHT.tablet : PANEL_ROW_HEIGHT.phone) + ROW_GAP;
  const [listHeight, setListHeight] = useState(0);
  const onListLayout = useCallback((e: LayoutChangeEvent) => {
    const measured = e.nativeEvent.layout.height;
    setListHeight((previous) => (previous > 0 ? previous : measured));
  }, []);
  // Ouverte sur l'épisode en cours, une ligne au-dessus pour le contexte, sans dépasser la fin.
  const opening = useMemo(() => {
    const index = openingEpisodeIndex(episodes);
    const visibleRows = listHeight > 0 ? Math.floor(listHeight / rowHeight) : 0;
    return Math.max(0, Math.min(index - 1, episodes.length - visibleRows));
  }, [episodes, listHeight, rowHeight]);
  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: rowHeight, offset: rowHeight * index, index }), [rowHeight]);
  const renderItem = useCallback(({ item }: { item: EpisodeEntry }) => (
    <View style={{ height: rowHeight }}>
      <PanelRow entry={item} thumbWidth={geo.thumbWidth} overviewLines={geo.overviewLines} large={isTablet} artwork={renderArtwork(item)} words={words} onPlay={onPlay} />
    </View>
  ), [rowHeight, geo.thumbWidth, geo.overviewLines, isTablet, renderArtwork, words, onPlay]);

  const inset = isTablet ? 22 : 18;
  const compact = side && !isTablet;
  const plateStyle = side
    ? { top: geo.top, right: geo.right, bottom: geo.bottom, left: geo.left, borderRadius: geo.radius }
    : { top: geo.top, right: 0, bottom: 0, left: 0, borderTopLeftRadius: geo.radius, borderTopRightRadius: geo.radius };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
      {side ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: enter }]}>
          <LinearGradient colors={[EB.scrim(0.12), EB.scrim(0.38), EB.scrim(0.62)]} locations={[0, 0.5, 1]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      <Animated.View style={[st.plate, plateStyle, { opacity: side ? enter : 1, transform: [side ? { translateX: slide } : { translateY: slide }] }]}>
        <BrowserGlass radius={geo.radius} solid={!side} />
        {!side ? <View style={st.grabber} /> : null}
        <View style={[st.header, { paddingHorizontal: inset, paddingTop: side ? (isTablet ? 22 : 14) : 22 }, compact && st.headerCompact]}>
          {/* Un téléphone couché n'a pas la hauteur de deux lignes de titre : la série suit « Épisodes ». */}
          <View style={compact ? st.headingsInline : st.headings}>
            <Text accessibilityRole="header" numberOfLines={1} style={[st.title, isTablet && st.titleLarge, compact && st.titleCompact]}>{t("panels.episodesTitle")}</Text>
            <Text numberOfLines={1} style={[st.series, compact && st.seriesInline]}>{seriesTitle}</Text>
          </View>
          <BrowserCloseButton onPress={onClose} size={isTablet ? 34 : 30} />
        </View>
        <SeasonChips seasons={seasons} activeId={activeSeasonId} onSelect={onSelectSeason} onIntent={onSeasonIntent} inset={inset} large={isTablet} />
        <View style={[st.rule, { marginHorizontal: inset }]} />
        <Animated.View style={[st.list, { opacity: swap.opacity, transform: [{ translateX: swap.translate }] }]} onLayout={onListLayout}>
          {loading || listHeight === 0 ? (
            <View style={[st.ghosts, { paddingHorizontal: inset - 10 }]}>
              {[0, 1, 2].map((i) => <View key={i} style={[st.ghost, { height: rowHeight - ROW_GAP }]} />)}
            </View>
          ) : (
            <FlatList
              key={activeSeasonId}
              data={episodes as EpisodeEntry[]}
              keyExtractor={(entry) => entry.id}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              initialScrollIndex={opening > 0 ? opening : undefined}
              initialNumToRender={8}
              windowSize={5}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: inset - 10, paddingTop: 8, paddingBottom: side ? 12 : Math.max(safe.bottom, 12) + 8 }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  plate: { position: "absolute", overflow: "hidden" },
  grabber: { alignSelf: "center", marginTop: 8, width: 36, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255, 255, 255, 0.28)" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 14 },
  headerCompact: { paddingBottom: 10 },
  headings: { flex: 1, gap: 2 },
  headingsInline: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: 8 },
  titleCompact: { fontSize: EB_TYPE.heading - 2 },
  seriesInline: { flexShrink: 1 },
  title: { color: EB.label, fontSize: EB_TYPE.heading, fontWeight: "700", letterSpacing: -0.35 },
  titleLarge: { fontSize: EB_TYPE.heading + 4 },
  series: { color: EB.secondary, fontSize: EB_TYPE.title - 1, fontWeight: "500" },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: EB.hairline, marginTop: 12 },
  list: { flex: 1 },
  ghosts: { gap: ROW_GAP, paddingTop: 8 },
  ghost: { borderRadius: 16, backgroundColor: EB.fill },
});
