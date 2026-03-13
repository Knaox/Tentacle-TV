import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@/theme";

interface Props {
  count: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function SelectionBar({ count, totalCount, onSelectAll, onDelete, onCancel }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <Text style={styles.countText}>{t("selectedCount", { count })}</Text>

      <View style={styles.actions}>
        <Pressable onPress={onSelectAll} style={styles.button}>
          <Text style={styles.selectAllText}>
            {count === totalCount ? t("cancel") : t("selectAll")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          disabled={count === 0}
          style={[styles.deleteButton, count === 0 && styles.deleteButtonDisabled]}
        >
          <Text style={[styles.deleteText, count === 0 && styles.deleteTextDisabled]}>
            {t("removeCount", { count })}
          </Text>
        </Pressable>

        <Pressable onPress={onCancel} style={styles.button}>
          <Text style={styles.cancelText}>{t("cancel")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.screenPadding,
  },
  countText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.surfaceElevated,
  },
  selectAllText: {
    ...typography.small,
    color: colors.accent,
    fontWeight: "600",
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.buttonRadius,
    backgroundColor: colors.danger,
    alignItems: "center",
  },
  deleteButtonDisabled: {
    backgroundColor: colors.dangerSurface,
  },
  deleteText: {
    ...typography.small,
    color: "#fff",
    fontWeight: "600",
  },
  deleteTextDisabled: {
    color: colors.textDim,
  },
  cancelText: {
    ...typography.small,
    color: colors.textMuted,
    fontWeight: "600",
  },
});
