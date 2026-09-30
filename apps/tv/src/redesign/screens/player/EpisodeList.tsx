import { memo, useCallback, useState } from "react";
import { FlatList, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { EPISODE_ROW_HEIGHT, EpisodeRow } from "./EpisodeRow";
import type { EpisodeRowModel } from "./playerTypes";

/**
 * Les lignes d'épisode du panneau, en liste VIRTUALISÉE : une saison de One
 * Piece en compte près de deux cents, et les monter toutes d'un coup — image
 * et calques de focus compris — coûtait des secondes à chaque ouverture. Seules
 * les lignes à l'écran, et deux écrans de part et d'autre, existent.
 *
 * Elle s'ouvre SUR l'épisode en cours, une ligne au-dessus pour le contexte,
 * sans dépasser la fin : la dernière page reste pleine. D'où la mesure de sa
 * propre hauteur avant de naître. Hauteur de ligne FIXE : la position de
 * chaque ligne se calcule au point près (`getItemLayout`).
 *
 * Clés : `episodes:episode:<n>` (rang dans la saison).
 */

const ROW_GAP = 14;
const STRIDE = EPISODE_ROW_HEIGHT + ROW_GAP;
const PAD_TOP = 22;

const keyOf = (episode: EpisodeRowModel) => episode.id;
// La marge du haut (PAD_TOP) reste HORS des positions : `initialScrollIndex`
// ouvre alors la ligne visée à cette distance du bord, comme la liste d'avant,
// au lieu de la coller sous les saisons. La fenêtre de virtualisation, elle,
// s'accommode de 22 points d'écart (deux écrans de marge de chaque côté).
const layoutOf = (_: unknown, index: number) => ({ length: STRIDE, offset: STRIDE * index, index });

export const EpisodeList = memo(function EpisodeList({
  episodes,
  nowPlayingLabel,
  onSelectEpisode,
}: {
  episodes: EpisodeRowModel[];
  nowPlayingLabel: string;
  onSelectEpisode?: (id: string) => void;
}) {
  const [height, setHeight] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.height;
    setHeight((previous) => (previous > 0 ? previous : measured));
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: EpisodeRowModel; index: number }) => (
      <View style={styles.cell}>
        <EpisodeRow
          episode={item}
          nowPlayingLabel={nowPlayingLabel}
          focusKey={`episodes:episode:${index}`}
          onPress={onSelectEpisode ? () => onSelectEpisode(item.id) : undefined}
        />
      </View>
    ),
    [nowPlayingLabel, onSelectEpisode],
  );

  const current = episodes.findIndex((episode) => episode.current);
  const visible = height > 0 ? Math.floor(height / STRIDE) : 0;
  const initial = current > 0 ? Math.max(0, Math.min(current - 1, episodes.length - visible)) : 0;

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      {height > 0 ? (
        <FlatList
          data={episodes}
          keyExtractor={keyOf}
          renderItem={renderItem}
          getItemLayout={layoutOf}
          initialScrollIndex={initial > 0 ? initial : undefined}
          initialNumToRender={Math.max(visible + 2, 6)}
          maxToRenderPerBatch={6}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  viewport: { flex: 1 },
  cell: { height: STRIDE },
  list: { paddingHorizontal: 28, paddingTop: PAD_TOP, paddingBottom: 40 },
});
