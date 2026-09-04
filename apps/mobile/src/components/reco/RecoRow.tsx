import { memo, useCallback } from "react";
import type { ReactNode } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import type { RecoRowItem } from "@tentacle-tv/api-client";
import { spacing, useThemedStyles, type AppTheme } from "@/theme";
import { RowHeader } from "@/components/RowHeader";
import { RecoCard } from "./RecoCard";

interface Props {
  title: string;
  items: RecoRowItem[];
  /** Après le titre (la puce du filtre de plateformes). */
  accessory?: ReactNode;
  canOpen: (item: RecoRowItem) => boolean;
  onItemPress: (item: RecoRowItem) => void;
  onItemLongPress: (item: RecoRowItem) => void;
}

/**
 * Rangée de recommandations — sœur de `MediaRow` (même en-tête, même piste,
 * même écart de 14 px), pour des items qui ne sont pas des MediaItem.
 */
export const RecoRow = memo(function RecoRow({ title, items, accessory, canOpen, onItemPress, onItemLongPress }: Props) {
  const st = useThemedStyles(makeStyles);
  const renderItem = useCallback(
    ({ item }: { item: RecoRowItem }) => (
      <RecoCard
        item={item}
        canOpen={canOpen(item)}
        onPress={() => onItemPress(item)}
        onLongPress={() => onItemLongPress(item)}
      />
    ),
    [canOpen, onItemPress, onItemLongPress],
  );

  return (
    <View style={st.root}>
      <RowHeader title={title} accessory={accessory} />
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
        decelerationRate="fast"
      />
    </View>
  );
});

const makeStyles = (_t: AppTheme) => StyleSheet.create({
  root: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.screenPadding, gap: 14 },
});
