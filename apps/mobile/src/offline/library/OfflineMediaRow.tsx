import { memo, useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import { watchStateOf } from "@tentacle-tv/offline-core";
import { RowHeader } from "@/components/RowHeader";
import { useCardWidth } from "@/contexts/CardDensityContext";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import type { OfflineEntry } from "@/offline/engineApi";
import { spacing } from "@/theme";
import { MOVIE_ART, SERIES_ART } from "./offlineArt";
import { OfflinePosterCard } from "./OfflinePosterCard";

interface Props {
  title: string;
  entries: readonly OfflineEntry[];
  onOpen: (entry: OfflineEntry) => void;
  onLongPress: (entry: OfflineEntry) => void;
}

/**
 * Une rangée de l'accueil local — « Reprendre la lecture », « À suivre » —,
 * dans la grammaire des rangées en ligne (`MediaRow`) : en-tête au rail de
 * marque, affiches 2:3 à la largeur du compte, défilement horizontal. Un
 * épisode montre le visage de sa SÉRIE, comme en ligne : son affiche, sa note,
 * et « S01E03 · Titre » dessous.
 */
export const OfflineMediaRow = memo(function OfflineMediaRow({ title, entries, onOpen, onLongPress }: Props) {
  const width = useCardWidth();
  const renderItem = useCallback(
    ({ item }: { item: OfflineEntry }) => (
      <RowTile entry={item} width={width} onOpen={onOpen} onLongPress={onLongPress} />
    ),
    [width, onOpen, onLongPress],
  );
  if (entries.length === 0) return null;
  return (
    <View style={st.root}>
      <RowHeader title={title} />
      <FlatList
        horizontal
        data={entries as OfflineEntry[]}
        keyExtractor={(entry) => String(entry.id)}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
        decelerationRate="fast"
      />
    </View>
  );
});

function RowTile({ entry, width, onOpen, onLongPress }: {
  entry: OfflineEntry;
  width: number;
  onOpen: (entry: OfflineEntry) => void;
  onLongPress: (entry: OfflineEntry) => void;
}) {
  const isEpisode = entry.kind === "episode";
  // La note de ce que l'affiche montre : la série pour un épisode, le film sinon.
  const { data } = useLocalSnapshotJson<MediaItem>(entry.itemId, isEpisode ? "series.json" : "item.json");
  const { watched, percent } = watchStateOf(entry);
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? `${formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })} · `
    : "";
  const title = `${code}${entry.title ?? entry.itemId}`;
  return (
    <OfflinePosterCard
      title={title}
      subtitle={isEpisode ? entry.seriesName : null}
      posterItemId={entry.itemId}
      candidates={isEpisode ? SERIES_ART : MOVIE_ART}
      watched={watched}
      percent={percent}
      rating={data?.CommunityRating ?? null}
      width={width}
      onPress={() => onOpen(entry)}
      onLongPress={() => onLongPress(entry)}
      accessibilityLabel={percent !== null ? `${title}, ${Math.round(percent)} %` : title}
    />
  );
}

const st = StyleSheet.create({
  root: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.screenPadding, gap: 14 },
});
