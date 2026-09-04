import { memo, useCallback } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, useThemedStyles, type AppTheme } from "@/theme";
import { RowHeader } from "@/components/RowHeader";

interface Props {
  title: string;
  data: MediaItem[];
  renderItem: (item: MediaItem) => React.ReactNode;
  onSeeAll?: () => void;
}

/**
 * Row horizontal cinematic — en-tête `RowHeader` (heading-3 + lien "Voir tout"
 * chevron subtle violet). Gap 14px entre cards, scroll snap horizontal
 * edge-to-edge.
 */
export const MediaRow = memo(function MediaRow({ title, data, renderItem, onSeeAll }: Props) {
  const st = useThemedStyles(makeStyles);
  const renderFlatItem = useCallback(
    ({ item }: { item: MediaItem }) => <View>{renderItem(item)}</View>,
    [renderItem],
  );

  return (
    <View style={st.root}>
      <RowHeader title={title} onSeeAll={onSeeAll} />
      <FlatList
        horizontal
        data={data}
        // Id seul ne suffit pas : deux runs d'une même série dans « Derniers
        // ajouts » partagent le même SeriesId (cf. groupLatestByRuns).
        keyExtractor={(item, index) => `${item.Id}:${index}`}
        renderItem={renderFlatItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
        decelerationRate="fast"
        scrollEventThrottle={16}
      />
    </View>
  );
});

const makeStyles = (_t: AppTheme) => StyleSheet.create({
  root: { marginTop: spacing.xxl },
  list: {
    paddingHorizontal: spacing.screenPadding,
    gap: 14,
  },
});
