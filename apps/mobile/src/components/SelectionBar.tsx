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
  /** Libellé du bouton rouge (défaut : « Retirer (N) » de `common`). */
  removeLabel?: string;
  /** Un geste de plus, entre « tout » et le bouton rouge (« Auto-suppression… »). */
  secondaryAction?: { label: string; onPress: () => void };
}

/**
 * Barre flottante d'actions multi-select : surface s1 floating avec border
 * subtle, pill bouton supprimer rouge avec halo, secondaires en verre
 * minimal — sur deux rangées, un téléphone n'en aligne pas quatre.
 */
export function SelectionBar({ count, totalCount, onSelectAll, onDelete, onCancel, removeLabel, secondaryAction }: Props) {
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
        {/* Rangée 1 : le compte, le geste secondaire, la croix. Rangée 2 :
            « Tout sélectionner » et le bouton rouge — quatre pilules sur une
            seule ligne débordaient d'un téléphone. */}
        <View style={styles.header}>
          <Text style={styles.countText} numberOfLines={1}>
            {t("selectedCount", { count })}
          </Text>
          {secondaryAction && (
            <Pressable
              onPress={secondaryAction.onPress}
              disabled={disabled}
              style={styles.secondaryBtn}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
              accessibilityState={{ disabled }}
              hitSlop={6}
            >
              <Feather name="clock" size={16} color={colors.text.tertiary} />
              <Text style={styles.secondaryTxt} numberOfLines={1}>{secondaryAction.label}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={onCancel}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t("cancel")}
            hitSlop={6}
          >
            <Feather name="x" size={16} color={colors.text.tertiary} />
          </Pressable>
        </View>

        <View style={styles.actions}>
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
            <Text style={[styles.secondaryTxt, { color: colors.brand.light }]} numberOfLines={1}>
              {allSelected ? t("cancel") : t("selectAll")}
            </Text>
          </Pressable>

          <Pressable
            onPress={onDelete}
            disabled={disabled}
            style={[styles.deleteBtn, disabled && styles.deleteBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel={removeLabel ?? t("removeCount", { count })}
            accessibilityState={{ disabled }}
            hitSlop={6}
          >
            <Feather name="trash-2" size={16} color={disabled ? colors.text.quaternary : colors.cta.brandFg} />
            <Text style={[styles.deleteTxt, disabled && styles.deleteTxtDisabled]} numberOfLines={1}>
              {removeLabel ?? t("removeCount", { count })}
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
    header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginBottom: spacing.sm },
    countText: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.brand.light,
      letterSpacing: 0.3,
      flex: 1,
      minWidth: 0,
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
      flexShrink: 1,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
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
