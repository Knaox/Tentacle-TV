import { useRef, useState, useCallback } from "react";
import { FlatList, View, Text, TVFocusGuideView, type ViewStyle, type LayoutChangeEvent } from "react-native";
import { Focusable } from "./Focusable";
import { useTVRemote } from "./useTVRemote";
import { useTVNav } from "../../context/TVNavContext";
import { Colors, Spacing, Typography } from "../../theme/colors";

interface FocusableRowProps<T> {
  title?: string;
  data: T[];
  /** `focused` permet de révéler la méta qualité au focus (hover web). */
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
  itemWidth: number;
  gap?: number;
  style?: ViewStyle;
  onItemPress?: (item: T) => void;
  /** Called when user navigates left past the first item */
  onEdgeLeft?: () => void;
  /** Called when any item in this row receives focus */
  onRowFocus?: () => void;
  /** Called when an individual item gains focus — used by ambient backdrop */
  onItemFocus?: (item: T, index: number) => void;
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
  onItemFocus,
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
        viewOffset: Spacing.rowGutter,
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
          // `mb-1` web : la piste porte déjà 32 pt de réserve haute.
          marginBottom: 4,
          paddingHorizontal: Spacing.rowGutter,
        }}>
          {title}
        </Text>
      )}
      {/* Pas de trapFocusLeft : LEFT depuis la 1re carte doit atteindre le rail. */}
      <TVFocusGuideView trapFocusRight>
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ overflow: "visible" }}
        // `pt-8 / pb-6` web : la réserve haute absorbe l'anneau et le scale
        // 1.08 (origine bas) de la carte focusée, sans rognage ni chevauchement.
        contentContainerStyle={{ paddingHorizontal: Spacing.rowGutter, paddingTop: 32, paddingBottom: 24 }}
        keyExtractor={keyExtractor}
        initialNumToRender={6}
        windowSize={21}
        maxToRenderPerBatch={10}
        getItemLayout={(_, index) => ({
          length: itemWidth + gap,
          offset: (itemWidth + gap) * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <RowCell
            item={item}
            index={index}
            itemWidth={itemWidth}
            gap={gap}
            renderItem={renderItem}
            onCellFocus={() => {
              focusedIndexRef.current = index;
              rowHasFocusRef.current = true;
              scrollToIndex(index);
              onRowFocus?.();
              onItemFocus?.(item, index);
            }}
            onCellBlur={() => {
              if (focusedIndexRef.current === index) rowHasFocusRef.current = false;
            }}
            onPress={onItemPress ? () => onItemPress(item) : undefined}
            onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
          />
        )}
      />
      </TVFocusGuideView>
    </View>
  );
}

/** Cellule à état de focus local — seule la cellule re-render au focus. */
function RowCell<T>({ item, index, itemWidth, gap, renderItem, onCellFocus, onCellBlur, onPress, onLongPress }: {
  item: T; index: number; itemWidth: number; gap: number;
  renderItem: (item: T, index: number, focused: boolean) => React.ReactNode;
  onCellFocus: () => void; onCellBlur: () => void;
  onPress?: () => void; onLongPress?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const cellRef = useRef<View>(null);
  const { lastContentNodeRef } = useTVNav();
  return (
    <View style={{ width: itemWidth, marginRight: gap, overflow: "visible" }}>
      <Focusable
        ref={cellRef}
        variant="card"
        onFocus={() => {
          setFocused(true);
          // Mémoire de focus : dernier élément de contenu focalisé → restaure le
          // focus en sortant de la sidebar (tvOS) et au retour d'un écran empilé
          // (détail/lecteur) — sur Android, sans elle le moteur natif rendait le
          // focus à la sidebar à chaque retour sur l'accueil.
          lastContentNodeRef.current = cellRef.current;
          onCellFocus();
        }}
        onBlur={() => { setFocused(false); onCellBlur(); }}
        onPress={onPress}
        onLongPress={onLongPress}
        focusRadius={8}
      >
        {renderItem(item, index, focused)}
      </Focusable>
    </View>
  );
}
