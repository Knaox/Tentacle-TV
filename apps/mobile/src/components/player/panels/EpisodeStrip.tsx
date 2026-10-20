import { useCallback, type ReactElement } from "react";
import { FlatList, StyleSheet } from "react-native";
import { EPISODE_CARD_GAP } from "../../../player/panels/panelLayout";
import { EPISODE_ROW_HEIGHT } from "./EpisodeTile";

interface Props<T> {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** `shelf` : défilement de côté (paysage, iPad) ; sinon une liste qui défile vers le bas. */
  horizontal: boolean;
  cardWidth: number;
  /** L'épisode en cours : la liste s'ouvre sur lui. */
  currentIndex: number;
  renderTile: (item: T) => ReactElement;
}

/**
 * Les épisodes d'une saison : une étagère qui défile de côté, comme l'app TV
 * d'Apple, ou une liste qui défile vers le bas sur un téléphone debout. Les
 * pas sont FIXES (carte, ligne) : la liste s'ouvre sur l'épisode en cours
 * sans rien mesurer.
 */
export function EpisodeStrip<T>({ items, keyOf, horizontal, cardWidth, currentIndex, renderTile }: Props<T>) {
  const step = horizontal ? cardWidth + EPISODE_CARD_GAP : EPISODE_ROW_HEIGHT;
  const getItemLayout = useCallback((_: ArrayLike<T> | null | undefined, index: number) => (
    { length: step, offset: step * index, index }
  ), [step]);
  return (
    <FlatList
      // Une clé par sens : FlatList ne change pas d'axe à chaud.
      key={horizontal ? "shelf" : "list"}
      data={items as T[]}
      keyExtractor={keyOf}
      horizontal={horizontal}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      getItemLayout={getItemLayout}
      initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
      initialNumToRender={8}
      windowSize={5}
      style={horizontal ? undefined : st.fill}
      contentContainerStyle={horizontal ? st.shelf : st.list}
      renderItem={({ item }) => renderTile(item)}
    />
  );
}

const st = StyleSheet.create({
  shelf: { paddingHorizontal: 16, paddingBottom: 14, gap: EPISODE_CARD_GAP },
  list: { paddingHorizontal: 6, paddingBottom: 12 },
  fill: { flex: 1 },
});
