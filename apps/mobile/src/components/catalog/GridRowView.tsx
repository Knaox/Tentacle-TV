import { Fragment, memo, useMemo, useRef, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { chunkGridRows, type GridRow } from "./gridRows";

/** Les rangées STABLES d'une grille de titres (voir `gridRows.ts`). */
export function useGridRows(items: readonly MediaItem[], columns: number): GridRow<MediaItem>[] {
  const cache = useRef<ReadonlyMap<string, GridRow<MediaItem>>>(new Map());
  return useMemo(() => {
    const { rows, cache: next } = chunkGridRows(items, columns, cache.current);
    cache.current = next;
    return rows;
  }, [items, columns]);
}

interface Props {
  row: GridRow<MediaItem>;
  style: StyleProp<ViewStyle>;
  /** Le rendu d'une cellule — stable (`useCallback`), comme `row`. */
  renderCell: (item: MediaItem) => ReactNode;
}

/** Une rangée de grille : elle ne se re-rend que si SES titres ou son rendu changent. */
export const GridRowView = memo(function GridRowView({ row, style, renderCell }: Props) {
  return (
    <View style={style}>
      {row.map((item) => <Fragment key={item.Id}>{renderCell(item)}</Fragment>)}
    </View>
  );
});
