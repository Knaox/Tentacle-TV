import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  BRAND,
  BORDER,
  FONT_FAMILY,
  SHADOW_RN,
  STATUS,
  SURFACE,
} from "@/theme";

interface Props {
  count: number;
  totalCount: number;
  onSelectAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Barre flottante d'actions multi-select : surface s1 floating avec border
 * subtle, pill bouton supprimer rouge avec halo, secondaire glass minimal.
 */
export function SelectionBar({ count, totalCount, onSelectAll, onDelete, onCancel }: Props) {
  const { t } = useTranslation("common");
  const insets = useSafeAreaInsets();
  const allSelected = count > 0 && count === totalCount;
  const disabled = count === 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, spacing.md),
          paddingTop: spacing.md,
        },
      ]}
    >
      <View style={styles.bar}>
        <Text style={styles.countText} numberOfLines={1}>
          {t("selectedCount", { count })}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onCancel}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
            hitSlop={6}
          >
            <Feather name="x" size={16} color={colors.textMuted} />
            <Text style={styles.secondaryTxt}>{t("cancel")}</Text>
          </Pressable>

          <Pressable
            onPress={onSelectAll}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel={allSelected ? t("cancel") : t("selectAll")}
            hitSlop={6}
          >
            <Feather
              name={allSelected ? "minus-square" : "check-square"}
              size={16}
              color={BRAND.light}
            />
            <Text style={[styles.secondaryTxt, { color: BRAND.light }]}>
              {allSelected ? t("cancel") : t("selectAll")}
            </Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            disabled={disabled}
            style={[styles.deleteBtn, disabled && styles.deleteBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t("removeCount", { count })}
            accessibilityState={{ disabled }}
            hitSlop={6}
          >
            <Feather name="trash-2" size={16} color={disabled ? "rgba(255,255,255,0.4)" : "#fff"} />
            <Text style={[styles.deleteTxt, disabled && styles.deleteTxtDisabled]}>
              {t("removeCount", { count })}
            </Text>
          </Pressable>
        </View>
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
    paddingHorizontal: spacing.screenPadding,
  },
  bar: {
    backgroundColor: SURFACE.s1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: BORDER.strong,
    ...SHADOW_RN.elev3,
  },
  countText: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.semibold,
    color: BRAND.light,
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: BORDER.subtle,
    minWidth: 44,
  },
  secondaryTxt: {
    ...typography.small,
    fontFamily: FONT_FAMILY.semibold,
    color: colors.textMuted,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: STATUS.error,
    shadowColor: STATUS.error,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  deleteBtnDisabled: {
    backgroundColor: "rgba(239,68,68,0.18)",
    shadowOpacity: 0,
  },
  deleteTxt: {
    ...typography.small,
    fontFamily: FONT_FAMILY.bold,
    color: "#fff",
    letterSpacing: 0.2,
  },
  deleteTxtDisabled: {
    color: "rgba(255,255,255,0.4)",
  },
});
