import { useRef, useCallback } from "react";
import { FlatList, View, type ViewStyle } from "react-native";
import { Focusable } from "./Focusable";

interface FocusableGridProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  numColumns?: number;
  itemHeight?: number;
  gap?: number;
  style?: ViewStyle;
  onItemPress?: (item: T) => void;
  /** Give hasTVPreferredFocus to the first item */
  autoFocusFirst?: boolean;
  onItemLongPress?: (item: T) => void;
}

export function FocusableGrid<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns = 5,
  itemHeight = 280,
  gap = 16,
  style,
  onItemPress,
  autoFocusFirst = false,
  onItemLongPress,
}: FocusableGridProps<T>) {
  const listRef = useRef<FlatList>(null);

  const scrollToRow = useCallback(
    (index: number) => {
      const row = Math.floor(index / numColumns);
      // Offset slightly so the focused row isn't flush at the top
      const targetOffset = Math.max(0, row * (itemHeight + gap) - gap);
      listRef.current?.scrollToOffset({
        offset: targetOffset,
        animated: true,
      });
    },
    [numColumns, itemHeight, gap]
  );

  if (data.length === 0) return null;

  return (
    <FlatList
      ref={listRef}
      data={data}
      numColumns={numColumns}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 48, paddingVertical: 24 }}
      keyExtractor={keyExtractor}
      style={[{ overflow: "visible" }, style]}
      columnWrapperStyle={{ gap }}
      renderItem={({ item, index }) => (
        <View style={{ flex: 1, maxWidth: `${100 / numColumns}%`, marginBottom: gap, overflow: "visible" }}>
          <Focusable
            variant="card"
            onPress={() => onItemPress?.(item)}
            onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
            onFocus={() => scrollToRow(index)}
            hasTVPreferredFocus={autoFocusFirst && index === 0}
          >
            {renderItem(item, index)}
          </Focusable>
        </View>
      )}
    />
  );
}
