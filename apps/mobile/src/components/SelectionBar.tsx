import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import {
  spacing,
  typography,
  FONT_FAMILY,
  SHADOW_RN,
  useTheme,
  useThemedStyles,
  withAlpha,
  type AppTheme,
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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            <Feather name="x" size={16} color={colors.text.tertiary} />
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
              color={colors.brand.light}
            />
            <Text style={[styles.secondaryTxt, { color: colors.brand.light }]}>
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
            <Feather name="trash-2" size={16} color={disabled ? colors.text.quaternary : colors.cta.brandFg} />
            <Text style={[styles.deleteTxt, disabled && styles.deleteTxtDisabled]}>
              {t("removeCount", { count })}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: spacing.screenPadding,
      alignItems: "center",
    },
    bar: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: t.colors.surface.s1,
      borderRadius: 20,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: t.colors.border.strong,
      ...SHADOW_RN.elev3,
    },
    countText: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.brand.light,
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
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      minWidth: 44,
    },
    secondaryTxt: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
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
      backgroundColor: t.colors.status.error,
      shadowColor: t.colors.status.error,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
    },
    deleteBtnDisabled: {
      backgroundColor: withAlpha(t.colors.status.error, 0.18, t.colors.danger.surface),
      shadowOpacity: 0,
    },
    deleteTxt: {
      ...typography.small,
      fontFamily: FONT_FAMILY.bold,
      // Blanc sur couleur status pleine — cta.brandFg = "sur couleur vive".
      color: t.colors.cta.brandFg,
      letterSpacing: 0.2,
    },
    deleteTxtDisabled: {
      color: t.colors.text.quaternary,
    },
  });
