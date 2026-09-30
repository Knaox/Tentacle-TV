import { memo, useCallback, useState } from "react";
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useForcedFocusKey } from "../../focus/focusPreview";
import { white } from "../../theme/tokens";
import { DETAIL_LEFT } from "./DetailSection";
import { EPISODE_CARD, EpisodeCard } from "./EpisodeCard";
import type { EpisodeModel } from "./detailTypes";

/**
 * Les épisodes d'une saison, en grandes vignettes à l'horizontale. La
 * rangée s'ouvre sur l'épisode à reprendre (ou l'épisode ouvert), calé à
 * gauche ; une saison de 80 épisodes ne monte que ce qui se voit. Quand une
 * vignette a le focus, ses voisines reculent. Pendant le chargement de la
 * saison : des vignettes fantômes, immobiles.
 *
 * Contrat : `useSeasonBrowser().episodes` (liste légère, puis sources),
 * `useSeriesWatchState` (le badge), `resolveCardMarkers` (vu, jauge).
 */

const STEP = EPISODE_CARD.width + TV_STAGE.row.gap;

function Ghosts() {
  return (
    <View style={styles.ghosts}>
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.ghost}>
          <View style={styles.ghostImage} />
          <View style={[styles.ghostLine, { width: 150 }]} />
          <View style={[styles.ghostLine, { width: 360, height: 26 }]} />
          <View style={[styles.ghostLine, { width: 300 }]} />
        </View>
      ))}
    </View>
  );
}

export const EpisodeRail = memo(function EpisodeRail({
  episodes,
  anchorIndex = 0,
  onPlay,
  onLongPress,
  onFocusChange,
}: {
  episodes: EpisodeModel[] | null;
  anchorIndex?: number;
  onPlay?: (episode: EpisodeModel) => void;
  onLongPress?: (episode: EpisodeModel) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [nativeIndex, setNativeIndex] = useState<number | null>(null);
  const forced = useForcedFocusKey();
  const forcedIndex = forced?.startsWith("episode:") ? Number(forced.slice(8)) : null;
  const focusedIndex = forced !== null ? forcedIndex : nativeIndex;

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<EpisodeModel>) => (
      <View style={styles.item}>
        <EpisodeCard
          episode={item}
          focusKey={`episode:${index}`}
          dimmed={focusedIndex !== null && focusedIndex !== index}
          onPress={onPlay ? () => onPlay(item) : undefined}
          onLongPress={onLongPress ? () => onLongPress(item) : undefined}
          onFocusChange={(focused) => {
            setNativeIndex((current) => (focused ? index : current === index ? null : current));
            onFocusChange?.(focused);
          }}
        />
      </View>
    ),
    [focusedIndex, onPlay, onLongPress, onFocusChange],
  );

  if (episodes === null) return <Ghosts />;
  const initial = Math.min(Math.max(0, anchorIndex), Math.max(0, episodes.length - 1));
  return (
    <FlatList
      horizontal
      data={episodes}
      keyExtractor={(episode) => episode.id}
      renderItem={renderItem}
      extraData={focusedIndex}
      // Le décalage ne compte pas la marge de gauche : l'épisode d'ouverture
      // arrive calé sur la colonne de contenu, pas contre le bord.
      getItemLayout={(_, index) => ({ length: STEP, offset: STEP * index, index })}
      initialScrollIndex={initial > 0 ? initial : undefined}
      initialNumToRender={6}
      windowSize={5}
      showsHorizontalScrollIndicator={false}
      style={styles.track}
      contentContainerStyle={styles.content}
    />
  );
});

const styles = StyleSheet.create({
  // Le débord laisse la place à l'agrandissement, au halo et à l'ombre.
  track: { overflow: "visible" },
  content: { paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x - TV_STAGE.row.gap, paddingTop: 22, paddingBottom: 30 },
  item: { width: STEP, paddingRight: TV_STAGE.row.gap },
  ghosts: { flexDirection: "row", gap: TV_STAGE.row.gap, paddingLeft: DETAIL_LEFT, paddingTop: 22, paddingBottom: 30 },
  ghost: { width: EPISODE_CARD.width, gap: 12 },
  ghostImage: { width: EPISODE_CARD.width, height: EPISODE_CARD.height, borderRadius: EPISODE_CARD.radius, backgroundColor: white(0.07), marginBottom: 8 },
  ghostLine: { height: 22, borderRadius: 11, backgroundColor: white(0.07) },
});
