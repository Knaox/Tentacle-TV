import { useCallback, useMemo, useRef, useState } from "react";
import { Animated, FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { TABLET_MIN_WIDTH } from "@/theme";
import { useChromeInsets } from "../../../../player/chrome/useChromeInsets";
import { openingEpisodeIndex, type EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { indexGeometry } from "../../../../player/episodes/episodeBrowserLayout";
import { BrowserCloseButton } from "../BrowserCloseButton";
import { EB, EB_TYPE } from "../browserTokens";
import { SeasonChips } from "../panel/SeasonChips";
import type { EpisodeBrowserProps } from "../types";
import { useBackCloses, useEntrance, useSeasonSwap } from "../useBrowserMotion";
import { useEpisodeWords } from "../useEpisodeWords";
import { IndexRow } from "./IndexRow";
import { IndexSeasonList } from "./IndexSeasonList";

/** La hauteur d'une entrée repliée, pour ouvrir le sommaire sur l'épisode en cours. */
const ROW_ESTIMATE = { phone: 128, tablet: 150 } as const;

/**
 * Piste C — le sommaire. La liste prend tout l'écran, comme la table des
 * matières d'un livre : la série en grand, les saisons en colonne (paysage) ou
 * en pastilles (debout), et les épisodes en entrées NUMÉROTÉES, le résumé
 * replié sous chacune. Dessous, une image FIXE de la série, floutée une fois
 * pour toutes — jamais un flou recalculé sur la vidéo qui joue.
 */
export function IndexBrowser(props: EpisodeBrowserProps) {
  const { seriesTitle, seasons, activeSeasonId, onSelectSeason, onSeasonIntent, episodes, loading, renderArtwork, onPlay, onClose, backdropUri } = props;
  const { t } = useTranslation(["player", "common"]);
  const { width, height } = useWindowDimensions();
  const edges = useChromeInsets();
  const safe = useSafeAreaInsets();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const geo = indexGeometry({ width, height, isTablet, edges, safe });
  const words = useEpisodeWords();
  const enter = useEntrance();
  useBackCloses(onClose);
  const swap = useSeasonSwap(activeSeasonId, 0);
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = useCallback((id: string) => setExpanded((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);

  const totalEpisodes = seasons.reduce((sum, season) => sum + (season.count ?? 0), 0);
  const meta = [
    seasons.length > 1 ? t("common:seasonsCount", { count: seasons.length }) : null,
    totalEpisodes > 0 ? t("common:seasonTabEpisodes", { count: totalEpisodes }) : null,
  ].filter(Boolean).join(" · ");
  const opening = useMemo(() => openingEpisodeIndex(episodes), [episodes]);
  const estimate = isTablet ? ROW_ESTIMATE.tablet : ROW_ESTIMATE.phone;
  const listRef = useRef<FlatList<EpisodeEntry>>(null);
  const renderItem = useCallback(({ item }: { item: EpisodeEntry }) => (
    <IndexRow entry={item} thumbWidth={geo.thumbWidth} large={isTablet} expanded={expanded.has(item.id)} artwork={renderArtwork(item)} words={words} onPlay={onPlay} onToggle={toggle} />
  ), [geo.thumbWidth, isTablet, expanded, renderArtwork, words, onPlay, toggle]);

  const two = geo.columns === 2;
  const { padding } = geo;
  const heading = (
    <View style={st.headingBlock}>
      <Text accessibilityRole="header" numberOfLines={2} style={[st.series, isTablet && st.seriesLarge]}>{seriesTitle}</Text>
      {meta ? <Text style={st.meta}>{meta}</Text> : null}
    </View>
  );
  const list = loading ? null : (
    <FlatList
      ref={listRef}
      key={activeSeasonId}
      data={episodes as EpisodeEntry[]}
      keyExtractor={(entry) => entry.id}
      renderItem={renderItem}
      extraData={expanded}
      initialNumToRender={Math.min(60, Math.max(10, opening + 6))}
      contentOffset={{ x: 0, y: Math.max(0, opening - (two ? 0 : 1)) * estimate }}
      onScrollToIndexFailed={() => undefined}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={{ paddingBottom: padding.bottom + 12, paddingTop: two ? 0 : 4 }}
    />
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, st.root, { opacity: enter }]}>
      {backdropUri ? <Image source={{ uri: backdropUri }} blurRadius={isTablet ? 60 : 40} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, st.veil]} />
      <Animated.View style={[st.body, { paddingTop: padding.top, paddingLeft: padding.left, paddingRight: padding.right, transform: [{ translateY: rise }] }]}>
        {two ? (
          <View style={st.columns}>
            <View style={{ width: geo.seasonsWidth, gap: 18 }}>
              <View style={st.closeRow}><BrowserCloseButton onPress={onClose} size={isTablet ? 34 : 30} /></View>
              {heading}
              <IndexSeasonList seasons={seasons} activeId={activeSeasonId} onSelect={onSelectSeason} onIntent={onSeasonIntent} large={isTablet} />
            </View>
            <Animated.View style={[st.listColumn, { opacity: swap.opacity }]}>{list}</Animated.View>
          </View>
        ) : (
          <>
            <View style={st.topRow}>
              {heading}
              <BrowserCloseButton onPress={onClose} size={isTablet ? 34 : 30} />
            </View>
            <View style={[st.chips, { marginHorizontal: -padding.left }]}>
              <SeasonChips seasons={seasons} activeId={activeSeasonId} onSelect={onSelectSeason} onIntent={onSeasonIntent} inset={padding.left} large={isTablet} />
            </View>
            <Animated.View style={[st.listColumn, { opacity: swap.opacity }]}>{list}</Animated.View>
          </>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function Separator() {
  return <View style={st.separator} />;
}

const st = StyleSheet.create({
  root: { backgroundColor: "#000000" },
  veil: { backgroundColor: "rgba(8, 8, 10, 0.72)" },
  body: { flex: 1 },
  columns: { flex: 1, flexDirection: "row", gap: 28 },
  closeRow: { flexDirection: "row" },
  headingBlock: { flexShrink: 1, gap: 4 },
  series: { color: EB.label, fontSize: EB_TYPE.display, lineHeight: EB_TYPE.display + 4, fontWeight: "800", letterSpacing: -0.6 },
  seriesLarge: { fontSize: EB_TYPE.display + 6, lineHeight: EB_TYPE.display + 10 },
  meta: { color: EB.secondary, fontSize: EB_TYPE.kicker + 1, fontWeight: "500" },
  listColumn: { flex: 1 },
  topRow: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingBottom: 18 },
  chips: { paddingBottom: 6 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: EB.hairline, marginLeft: 58 },
});
