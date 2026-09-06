import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import {
  spacing,
  typography,
  FONT_FAMILY,
  useThemedStyles,
  useThemeMode,
  type AppTheme,
  type ThemeMode,
} from "@/theme";
import { SegmentedChoice } from "./SegmentedChoice";

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};

/**
 * Sélecteur de thème clair / sombre / auto — le sélecteur segmenté commun
 * (même cadre et même dégradé que le web). "Auto" suit le réglage système en
 * live via Appearance ; le choix est persisté par appareil
 * (tentacle_theme_mode, voir ThemeProvider).
 */
export function ThemeModeToggle() {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  const st = useThemedStyles(makeStyles);

  return (
    <View>
      <Text style={st.label}>{t("theme")}</Text>
      <SegmentedChoice
        options={MODES.map((value) => ({ value, label: t(MODE_LABEL_KEYS[value]) }))}
        value={mode}
        onChange={(value) => setMode(value as ThemeMode)}
        accessibilityLabel={t("theme")}
      />
      <Text style={st.hint}>{t("themeAutoHint")}</Text>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: {
      ...typography.caption,
      fontFamily: FONT_FAMILY.medium,
      color: t.colors.text.tertiary,
      marginBottom: spacing.sm,
    },
    hint: {
      ...typography.caption,
      color: t.colors.text.quaternary,
      marginTop: spacing.sm,
    },
  });
