import { StyleSheet } from "react-native";
import { FONT_FAMILY, RADIUS, spacing, typography, type AppTheme } from "@/theme";

/**
 * Les lignes des sections de la Famille (profil, invitation, famille dont on
 * est membre) : la carte de `SettingsSection`, une hairline entre deux, une
 * cible d'au moins 44 pt pour chaque geste de droite.
 */
export const makeFamilyRowStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
    bordered: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
    body: { flex: 1, minWidth: 0 },
    title: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing.sm, rowGap: 2, marginTop: 3 },
    metaText: { ...typography.small, color: t.colors.text.tertiary },
    pinMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
    chip: { borderRadius: RADIUS.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, backgroundColor: t.colors.fill.soft },
    chipGuest: { backgroundColor: t.colors.brand.soft },
    chipText: { fontFamily: FONT_FAMILY.semibold, fontSize: 11, color: t.colors.text.secondary },
    chipGuestText: { color: t.colors.brand.light },
    iconBubble: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.brand.soft },
    // Gestes de droite : un texte, cible de 44 pt, la couleur et le mot disent l'effet.
    action: { minHeight: 44, minWidth: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
    actionText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    dangerText: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.status.error },
    pill: { minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: RADIUS.pill, backgroundColor: t.colors.brand.soft },
    dim: { opacity: 0.5 },
    pressed: { backgroundColor: t.colors.fill.subtle },
  });
