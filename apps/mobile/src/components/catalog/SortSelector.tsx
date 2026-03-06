import { memo, useCallback } from "react";
import { View, Pressable, Text, FlatList, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { BottomSheet } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

export const SORT_OPTIONS = [
  { labelKey: "sortDateDesc", sortBy: "DateCreated", sortOrder: "Descending" },
  { labelKey: "sortDateAsc", sortBy: "DateCreated", sortOrder: "Ascending" },
  { labelKey: "sortTitleAsc", sortBy: "SortName", sortOrder: "Ascending" },
  { labelKey: "sortTitleDesc", sortBy: "SortName", sortOrder: "Descending" },
  { labelKey: "sortYearDesc", sortBy: "ProductionYear,SortName", sortOrder: "Descending" },
  { labelKey: "sortYearAsc", sortBy: "ProductionYear,SortName", sortOrder: "Ascending" },
  { labelKey: "sortRatingDesc", sortBy: "CommunityRating,SortName", sortOrder: "Descending" },
  { labelKey: "sortRatingAsc", sortBy: "CommunityRating,SortName", sortOrder: "Ascending" },
] as const;

interface Props {
  sortIndex: number;
  onSortChange: (index: number) => void;
  visible: boolean;
  onClose: () => void;
}

export const SortSelector = memo(function SortSelector({ sortIndex, onSortChange, visible, onClose }: Props) {
  const { t } = useTranslation("common");

  const handleSelect = useCallback(
    (index: number) => {
      onSortChange(index);
      onClose();
    },
    [onSortChange, onClose],
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} snapPoints={[0.45, 0.7]}>
      <View style={styles.header}>
        <Feather name="sliders" size={18} color={colors.accent} />
        <Text style={styles.headerText}>{t("sortRecent")}</Text>
      </View>
      <FlatList
        data={SORT_OPTIONS}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          const isActive = index === sortIndex;
          return (
            <Pressable onPress={() => handleSelect(index)} style={styles.option}>
              <Text style={[styles.optionText, isActive && styles.optionTextActive]}>
                {t(item.labelKey)}
              </Text>
              {isActive && <Feather name="check" size={18} color={colors.accent} />}
            </Pressable>
          );
        }}
      />
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  headerText: { ...typography.subtitle, color: colors.textPrimary },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
  },
  optionText: { ...typography.body, color: colors.textSecondary },
  optionTextActive: { color: colors.accent, fontWeight: "600" },
});
