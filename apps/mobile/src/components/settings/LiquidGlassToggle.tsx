import { View, Text, Switch, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import {
  spacing,
  typography,
  FONT_FAMILY,
  useTheme,
  useThemedStyles,
  useThemeMode,
  type AppTheme,
} from "@/theme";

/**
 * Bascule Liquid Glass — NE REND RIEN si le rendu natif n'est pas supporté
 * (iOS < 26, Android), de sorte que l'option est absente là où elle n'a aucun
 * effet. Quand supporté : Switch natif + description du repli verre maison.
 */
export function LiquidGlassToggle() {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { liquidGlass } = useThemeMode();

  if (!liquidGlass.supported) return null;

  return (
    <View style={st.row}>
      <View style={st.textWrap}>
        <Text style={st.title}>{t("liquidGlassTitle")}</Text>
        <Text style={st.description}>{t("liquidGlassDescription")}</Text>
      </View>
      <Switch
        value={liquidGlass.enabled}
        onValueChange={liquidGlass.setEnabled}
        trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
        thumbColor={theme.colors.cta.brandFg}
        ios_backgroundColor={theme.colors.fill.medium}
        accessibilityLabel={t("liquidGlassTitle")}
      />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    textWrap: { flex: 1 },
    title: {
      ...typography.body,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.primary,
    },
    description: {
      ...typography.small,
      color: t.colors.text.tertiary,
      marginTop: 4,
      lineHeight: 17,
    },
  });
