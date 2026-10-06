import { Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { spacing, typography, FONT_FAMILY, LETTER_SPACING, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { PairTvCard } from "./PairTvCard";

/**
 * « Jumeler une TV », en tête d'« Appareils et TV » : la consigne, les cases
 * du code tout de suite — pas un écran de plus à ouvrir —, puis l'expiration
 * du code. Après un succès, on peut en jumeler une autre sur place ; la liste
 * des appareils, dessous, se relit d'elle-même (les mutations l'invalident).
 */
export function PairTvSection() {
  const { t } = useTranslation("pairing");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.wrap}>
      <Text style={st.title} accessibilityRole="header">{t("pairYourTV")}</Text>
      <Text style={st.hint}>{t("enterTVCode")}</Text>
      <PairTvCard allowAnother />
      <View style={st.note}>
        <Feather name="clock" size={12} color={theme.colors.text.quaternary} />
        <Text style={st.noteText}>{t("codeExpireNote")}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  title: {
    ...typography.caption,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: LETTER_SPACING.wide,
    color: t.colors.text.tertiary,
    textTransform: "uppercase" as const,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  hint: { ...typography.body, color: t.colors.text.secondary, marginBottom: spacing.md, marginLeft: spacing.xs },
  note: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, marginTop: spacing.sm, marginLeft: spacing.xs },
  noteText: { ...typography.small, color: t.colors.text.quaternary, flexShrink: 1 },
});
