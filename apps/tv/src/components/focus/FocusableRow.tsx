import { useRef, useCallback } from "react";
import { FlatList, View, Text, type ViewStyle } from "react-native";
import { Focusable } from "./Focusable";

interface FocusableRowProps<T> {
  title?: string;
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  itemWidth: number;
  gap?: number;
  style?: ViewStyle;
}

export function FocusableRow<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  itemWidth,
  gap = 16,
  style,
}: FocusableRowProps<T>) {
  const listRef = useRef<FlatList>(null);

  const scrollToIndex = useCallback(
    (index: number) => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewOffset: 48,
      });
    },
    []
  );

  if (data.length === 0) return null;

  return (
    <View style={style}>
      {title && (
        <Text style={{
          color: "#ffffff",
          fontSize: 22,
          fontWeight: "700",
          marginBottom: 12,
          paddingHorizontal: 48,
        }}>
          {title}
        </Text>
      )}
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 48 }}
        keyExtractor={keyExtractor}
        getItemLayout={(_, index) => ({
          length: itemWidth + gap,
          offset: (itemWidth + gap) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={{ width: itemWidth, marginRight: gap }}>
            <Focusable onFocus={() => scrollToIndex(index)}>
              {renderItem(item, index)}
            </Focusable>
          </View>
        )}
      />
    </View>
  );
}
