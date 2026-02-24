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
}

export function FocusableGrid<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns = 6,
  itemHeight = 280,
  gap = 16,
  style,
  onItemPress,
}: FocusableGridProps<T>) {
  const listRef = useRef<FlatList>(null);

  const scrollToRow = useCallback(
    (index: number) => {
      const row = Math.floor(index / numColumns);
      listRef.current?.scrollToOffset({
        offset: row * (itemHeight + gap),
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
      style={style}
      columnWrapperStyle={{ gap }}
      renderItem={({ item, index }) => (
        <View style={{ flex: 1, maxWidth: `${100 / numColumns}%`, marginBottom: gap }}>
          <Focusable
            onPress={() => onItemPress?.(item)}
            onFocus={() => scrollToRow(index)}
          >
            {renderItem(item, index)}
          </Focusable>
        </View>
      )}
    />
  );
}
