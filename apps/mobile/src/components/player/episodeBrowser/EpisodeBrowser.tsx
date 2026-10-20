import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated as RNAnimated, Pressable, StyleSheet, View, useWindowDimensions, type GestureResponderEvent } from "react-native";
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../player/chrome/useChromeInsets";
import { openingEpisodeIndex, type EpisodeEntry } from "../../../player/episodes/episodeBrowserModel";
import { openCardAt, openIndexAt, openShelfGeometry } from "../../../player/episodes/episodeBrowserLayout";
import { BrowserCloseButton } from "./BrowserCloseButton";
import { EB, ROW_SCRIM } from "./browserTokens";
import { SeasonWords } from "./SeasonWords";
import type { EpisodeBrowserProps } from "./types";
import { useBackCloses, useEntrance, useSeasonSwap } from "./useBrowserMotion";
import { useEpisodeWords } from "./useEpisodeWords";
import { OpenCard } from "./OpenCard";
import { OpenDetails } from "./OpenDetails";
import { useRowFrameProbe } from "./useRowFrameProbe";

const GAP = 12;
const TAP_SLOP = 8;

/**
 * La liste des épisodes du lecteur — la carte qui s'ouvre, celle des rangées
 * de la TV (choix de Damien, 21/10) : au repos, des
 * vignettes plus petites ; la carte posée au retrait de la rangée s'OUVRE —
 * plus grande, ses voisines poussées d'autant — et ses détails se lisent
 * dessous, avec « Lire ». Glisser fait s'ouvrir la suivante, en continu sous le
 * doigt ; toucher une carte l'ouvre, toucher la carte ouverte la lit.
 */
export function EpisodeBrowser(props: EpisodeBrowserProps) {
  const { seriesTitle, seasons, activeSeasonId, onSelectSeason, onSeasonIntent, episodes, loading, renderArtwork, renderMarkers, onPlay, onClose, video } = props;
  const { t } = useTranslation("player");
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const safe = useSafeAreaInsets();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const geo = openShelfGeometry({ width, height, isTablet, edges, safe }, video);
  const words = useEpisodeWords();
  const enter = useEntrance();
  useBackCloses(onClose);
  const swap = useSeasonSwap(activeSeasonId);
  const lift = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });

  const step = geo.restWidth + GAP;
  const opening = useMemo(() => openingEpisodeIndex(episodes), [episodes]);
  const progress = useSharedValue(opening);
  const announced = useSharedValue(opening);
  const [openIndex, setOpenIndex] = useState(opening);
  const listRef = useRef<Animated.FlatList<EpisodeEntry>>(null);
  // Une saison neuve s'ouvre sur SON épisode (la rangée renaît à cette place).
  useEffect(() => {
    progress.value = opening;
    announced.value = opening;
    setOpenIndex(opening);
  }, [activeSeasonId, opening, progress, announced]);
  const count = episodes.length;
  const probe = useRowFrameProbe();
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => probe.begin(),
    onEndDrag: (e) => { if (Math.abs(e.velocity?.x ?? 0) < 0.05) probe.end(); },
    onMomentumEnd: () => probe.end(),
    onScroll: (e) => {
      progress.value = e.contentOffset.x / step;
      // Le fil JS n'apprend que le changement de carte ouverte, pas chaque image.
      const open = openIndexAt(progress.value, count);
      if (open !== announced.value) {
        announced.value = open;
        runOnJS(setOpenIndex)(open);
      }
    },
  });

  // Le toucher : observé sur la rangée (aucun répondant volé au défilement),
  // retenu s'il n'a ni bougé ni duré, rendu à la carte qui est sous le doigt.
  const touch = useRef<{ x: number; y: number; at: number; progress: number } | null>(null);
  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, at: Date.now(), progress: progress.value };
  }, [progress]);
  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || Date.now() - start.at > 400 || Math.abs(progress.value - start.progress) > 0.02) return;
    if (Math.abs(e.nativeEvent.pageX - start.x) > TAP_SLOP || Math.abs(e.nativeEvent.pageY - start.y) > TAP_SLOP) return;
    const index = openCardAt(e.nativeEvent.pageX - geo.inset + progress.value * step, progress.value, step, geo.restWidth, geo.openWidth, episodes.length);
    if (index === null) return;
    if (index === openIndexAt(progress.value, episodes.length)) onPlay(episodes[index]);
    else listRef.current?.scrollToOffset({ offset: index * step, animated: true });
  }, [progress, geo.inset, geo.restWidth, geo.openWidth, step, episodes, onPlay]);

  const getItemLayout = useCallback((_: unknown, index: number) => ({ length: step, offset: step * index, index }), [step]);
  const renderItem = useCallback(({ item, index }: { item: EpisodeEntry; index: number }) => (
    <OpenCard
      entry={item}
      index={index}
      progress={progress}
      step={step}
      restWidth={geo.restWidth}
      openWidth={geo.openWidth}
      openHeight={geo.openHeight}
      radius={isTablet ? 16 : 13}
      artwork={renderArtwork(item)}
      markers={renderMarkers?.(item)}
      spoken={words.spoken(item)}
      onAccessibilityTap={() => onPlay(item)}
    />
  ), [progress, step, geo.restWidth, geo.openWidth, geo.openHeight, isTablet, renderArtwork, renderMarkers, words, onPlay]);

  const shown = episodes[openIndexAt(openIndex, episodes.length)];
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("close")} />
      {!geo.belowVideo ? (
        <RNAnimated.View pointerEvents="none" style={[st.scrim, { top: geo.top - ROW_SCRIM.lead, opacity: enter }]}>
          <LinearGradient colors={ROW_SCRIM.colors} locations={ROW_SCRIM.locations} style={StyleSheet.absoluteFill} />
        </RNAnimated.View>
      ) : null}
      <RNAnimated.View pointerEvents="box-none" style={[st.body, { top: geo.top, opacity: enter, transform: [{ translateY: lift }] }]}>
        <View style={[st.header, { paddingLeft: geo.inset, paddingRight: geo.inset - 4, height: isTablet ? 46 : 40 }]}>
          <SeasonWords seasons={seasons} activeId={activeSeasonId} onSelect={onSelectSeason} onIntent={onSeasonIntent} fallbackTitle={seriesTitle} large={isTablet} />
          <View style={st.spacer} />
          <BrowserCloseButton onPress={onClose} size={isTablet ? 34 : 30} />
        </View>
        <RNAnimated.View style={{ opacity: swap.opacity, transform: [{ translateX: swap.translate }] }}>
          {loading ? (
            <View style={[st.ghost, { marginLeft: geo.inset, width: geo.openWidth, height: geo.openHeight, borderRadius: isTablet ? 16 : 13 }]} />
          ) : (
            <View onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <Animated.FlatList
                ref={listRef}
                key={activeSeasonId}
                data={episodes as EpisodeEntry[]}
                keyExtractor={(entry) => entry.id}
                renderItem={renderItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={step}
                decelerationRate="fast"
                onScroll={onScroll}
                scrollEventThrottle={16}
                getItemLayout={getItemLayout}
                contentOffset={{ x: opening * step, y: 0 }}
                initialNumToRender={Math.max(8, opening + 5)}
                windowSize={5}
                style={{ height: geo.openHeight + 12 }}
                contentContainerStyle={{ paddingLeft: geo.inset, paddingRight: Math.max(geo.inset, width - geo.inset - geo.openWidth), gap: GAP, paddingTop: 12 }}
              />
            </View>
          )}
          <View style={{ paddingHorizontal: geo.inset, paddingTop: 12 }}>
            <OpenDetails entry={loading ? undefined : shown} height={geo.detailsHeight} titleLines={geo.titleLines} overviewLines={geo.overviewLines} large={isTablet} words={words} onPlay={onPlay} />
          </View>
        </RNAnimated.View>
      </RNAnimated.View>
    </View>
  );
}

const st = StyleSheet.create({
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0 },
  body: { position: "absolute", left: 0, right: 0 },
  header: { flexDirection: "row", alignItems: "center" },
  spacer: { flex: 1, minWidth: 12 },
  ghost: { marginTop: 12, backgroundColor: EB.fill },
});
