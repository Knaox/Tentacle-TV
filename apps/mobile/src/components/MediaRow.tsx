import { memo, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { colors, spacing, typography } from "@/theme";

interface Props {
  title: string;
  data: MediaItem[];
  renderItem: (item: MediaItem) => React.ReactNode;
  onSeeAll?: () => void;
}

export const MediaRow = memo(function MediaRow({ title, data, renderItem, onSeeAll }: Props) {
  const { t } = useTranslation("common");
  const renderFlatItem = useCallback(
    ({ item }: { item: MediaItem }) => <View>{renderItem(item)}</View>,
    [renderItem],
  );

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.title}>{title}</Text>
        {onSeeAll != null && (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={st.seeAll}>{t("seeAll")} {"\u203A"}</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item) => item.Id}
        renderItem={renderFlatItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.list}
      />
    </View>
  );
});

const st = StyleSheet.create({
  root: { marginTop: spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.screenPadding, marginBottom: spacing.md },
  title: { ...typography.subtitle, color: colors.textPrimary },
  seeAll: { ...typography.caption, color: colors.accent },
  list: { paddingHorizontal: spacing.screenPadding, gap: 12 },
});
