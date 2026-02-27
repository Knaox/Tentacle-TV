import { useRef, useCallback } from "react";
import { FlatList, View, Text, type ViewStyle } from "react-native";
import { Focusable } from "./Focusable";
import { Colors, Spacing, Typography } from "../../theme/colors";

interface FocusableRowProps<T> {
  title?: string;
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
  itemWidth: number;
  gap?: number;
  style?: ViewStyle;
  onItemPress?: (item: T) => void;
  /** Called when user navigates left past the first item */
  onEdgeLeft?: () => void;
}

export function FocusableRow<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  itemWidth,
  gap = Spacing.cardGap,
  style,
  onItemPress,
  onEdgeLeft,
}: FocusableRowProps<T>) {
  const listRef = useRef<FlatList>(null);

  const scrollToIndex = useCallback(
    (index: number) => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewOffset: Spacing.screenPadding,
      });
    },
    []
  );

  if (data.length === 0) return null;

  return (
    <View style={style}>
      {title && (
        <Text style={{
          color: Colors.textPrimary,
          ...Typography.sectionTitle,
          marginBottom: 20,
          paddingHorizontal: Spacing.screenPadding,
        }}>
          {title}
        </Text>
      )}
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding }}
        keyExtractor={keyExtractor}
        getItemLayout={(_, index) => ({
          length: itemWidth + gap,
          offset: (itemWidth + gap) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={{ width: itemWidth, marginRight: gap }}>
            <Focusable
              onFocus={() => scrollToIndex(index)}
              onPress={() => onItemPress?.(item)}
            >
              {renderItem(item, index)}
            </Focusable>
          </View>
        )}
      />
    </View>
  );
}
