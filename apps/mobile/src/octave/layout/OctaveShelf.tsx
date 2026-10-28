/**
 * Octave (mobile) — une ÉTAGÈRE horizontale (albums récents, artistes, ambiances…) :
 * virtualisée (seules les cartes proches de l'écran sont montées), calée sur la
 * marge de page à gauche, qui s'arrête carte par carte (aimantation douce). La
 * largeur d'une carte vient de `useOctaveLayout().shelfItemWidth` sauf mention.
 */

import { useCallback, type ReactElement } from "react";
import { FlatList, Platform, type ListRenderItem } from "react-native";
import { useOctaveLayout } from "./useOctaveLayout";
import { clipsOffscreenCells } from "./listClipping";

interface Props<T> {
  data: readonly T[];
  keyOf: (item: T, index: number) => string;
  renderItem: (item: T, width: number, index: number) => ReactElement | null;
  /** Largeur d'une carte (défaut : celle de la mise en page). */
  itemWidth?: number;
  accessibilityLabel?: string;
}

export function OctaveShelf<T>({ data, keyOf, renderItem, itemWidth, accessibilityLabel }: Props<T>) {
  const layout = useOctaveLayout();
  const width = itemWidth ?? layout.shelfItemWidth;
  const render = useCallback<ListRenderItem<T>>(({ item, index }) => renderItem(item, width, index), [renderItem, width]);
  const getItemLayout = useCallback((_: ArrayLike<T> | null | undefined, index: number) => ({ length: width + layout.gap, offset: (width + layout.gap) * index, index }), [width, layout.gap]);
  return (
    <FlatList
      horizontal
      data={data as T[]}
      keyExtractor={keyOf}
      renderItem={render}
      getItemLayout={getItemLayout}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: layout.gutter, gap: layout.gap }}
      snapToInterval={width + layout.gap}
      decelerationRate="fast"
      initialNumToRender={layout.isTablet ? 7 : 4}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews={clipsOffscreenCells(Platform.OS)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
