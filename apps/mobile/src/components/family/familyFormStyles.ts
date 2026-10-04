import { StyleSheet } from "react-native";
import { FONT_FAMILY, RADIUS, spacing, typography, type AppTheme } from "@/theme";

/** Les briques des feuilles de la Famille : libellé, aide, champ, erreur. */
export const makeFamilyFormStyles = (t: AppTheme) =>
  StyleSheet.create({
    lead: { ...typography.body, color: t.colors.text.secondary, lineHeight: 21, marginBottom: spacing.lg },
    label: {
      ...typography.small,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.secondary,
      marginBottom: spacing.xs + 2,
    },
    hint: { ...typography.small, color: t.colors.text.tertiary, marginTop: spacing.xs + 2, lineHeight: 17 },
    field: {
      ...typography.body,
      minHeight: 48,
      paddingHorizontal: spacing.md,
      borderRadius: RADIUS.md,
      backgroundColor: t.colors.surface.s1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      color: t.colors.text.primary,
    },
    error: {
      ...typography.small,
      color: t.colors.statusPairs.error.fg,
      marginTop: spacing.md,
      lineHeight: 18,
    },
    group: { marginBottom: spacing.lg },
  });
