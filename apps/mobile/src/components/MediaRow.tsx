import { memo, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTranslation } from "react-i18next";
import { colors, spacing, typography, BRAND, FONT_FAMILY } from "@/theme";

interface Props {
  title: string;
  data: MediaItem[];
  renderItem: (item: MediaItem) => React.ReactNode;
  onSeeAll?: () => void;
}

/**
 * Row horizontal cinematic — header avec heading-3 + lien "Voir tout" chevron
 * subtle violet. Gap 14px entre cards, scroll snap horizontal edge-to-edge.
 */
export const MediaRow = memo(function MediaRow({ title, data, renderItem, onSeeAll }: Props) {
  const { t } = useTranslation("common");
  const renderFlatItem = useCallback(
    ({ item }: { item: MediaItem }) => <View>{renderItem(item)}</View>,
    [renderItem],
  );

  return (
    <View style={st.root}>
      <View style={st.header}>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        {onSeeAll != null && (
          <Pressable onPress={onSeeAll} hitSlop={10} style={st.seeAllBtn}>
            <Text style={st.seeAll}>{t("seeAll")}</Text>
            <Feather name="chevron-right" size={14} color={BRAND.light} />
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
        decelerationRate="fast"
        scrollEventThrottle={16}
      />
    </View>
  );
});

const st = StyleSheet.create({
  root: { marginTop: spacing.xxl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.screenPadding,
    marginBottom: 14,
  },
  title: {
    ...typography.subtitle,
    fontFamily: FONT_FAMILY.bold,
    fontSize: 18,
    color: colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: 8,
  },
  seeAll: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.semibold,
    color: BRAND.light,
    letterSpacing: 0.1,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
    gap: 14,
  },
});
