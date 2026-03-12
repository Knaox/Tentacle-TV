import { useRef, useCallback } from "react";
import { FlatList, View, Text, type ViewStyle, type LayoutChangeEvent } from "react-native";
import { Focusable } from "./Focusable";
import { useTVRemote } from "./useTVRemote";
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
  /** Called when any item in this row receives focus */
  onRowFocus?: () => void;
  /** Layout callback for tracking row Y position */
  onLayout?: (event: LayoutChangeEvent) => void;
  onItemLongPress?: (item: T) => void;
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
  onRowFocus,
  onLayout,
  onItemLongPress,
}: FocusableRowProps<T>) {
  const listRef = useRef<FlatList>(null);
  const focusedIndexRef = useRef(-1);
  const rowHasFocusRef = useRef(false);

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

  // When the first item has focus and user presses left, fire onEdgeLeft
  useTVRemote({
    onLeft: onEdgeLeft
      ? () => {
          if (rowHasFocusRef.current && focusedIndexRef.current === 0) {
            onEdgeLeft();
          }
        }
      : undefined,
  });

  if (data.length === 0) return null;

  return (
    <View style={style} onLayout={onLayout}>
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
        style={{ overflow: "visible" }}
        contentContainerStyle={{ paddingHorizontal: Spacing.screenPadding, paddingVertical: 8 }}
        keyExtractor={keyExtractor}
        initialNumToRender={data.length}
        windowSize={21}
        maxToRenderPerBatch={10}
        getItemLayout={(_, index) => ({
          length: itemWidth + gap,
          offset: (itemWidth + gap) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={{ width: itemWidth, marginRight: gap, overflow: "visible" }}>
            <Focusable
              variant="card"
              onFocus={() => {
                focusedIndexRef.current = index;
                rowHasFocusRef.current = true;
                scrollToIndex(index);
                onRowFocus?.();
              }}
              onBlur={() => {
                if (focusedIndexRef.current === index) rowHasFocusRef.current = false;
              }}
              onPress={() => onItemPress?.(item)}
              onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
              focusRadius={8}
            >
              {renderItem(item, index)}
            </Focusable>
          </View>
        )}
      />
    </View>
  );
}
