import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useThemedStyles,
  useThemeMode,
  type AppTheme,
  type ThemeMode,
} from "@/theme";

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

const MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};

/**
 * Sélecteur de thème clair / sombre / auto — segmenté 3 options, pattern
 * LanguageToggle (radiogroup accessible). "Auto" suit le réglage système en
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
      <View style={st.row} accessibilityRole="radiogroup">
        {MODES.map((value) => (
          <ModeButton
            key={value}
            active={mode === value}
            label={t(MODE_LABEL_KEYS[value])}
            onPress={() => setMode(value)}
          />
        ))}
      </View>
      <Text style={st.hint}>{t("themeAutoHint")}</Text>
    </View>
  );
}

function ModeButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[st.btn, active ? st.btnActive : st.btnInactive]}
    >
      <Text style={[st.btnTxt, active ? st.btnTxtActive : st.btnTxtInactive]}>
        {label}
      </Text>
    </Pressable>
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
    row: { flexDirection: "row" as const, gap: spacing.sm },
    btn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: RADIUS.md,
      alignItems: "center" as const,
      borderWidth: 1,
    },
    btnActive: {
      backgroundColor: t.colors.brand.soft,
      borderColor: t.colors.brand.glow,
    },
    btnInactive: {
      backgroundColor: t.colors.fill.subtle,
      borderColor: t.colors.border.subtle,
    },
    btnTxt: {
      ...typography.bodyBold,
      fontSize: 14,
      fontFamily: FONT_FAMILY.semibold,
    },
    btnTxtActive: { color: t.colors.brand.light },
    btnTxtInactive: { color: t.colors.text.secondary },
    hint: {
      ...typography.caption,
      color: t.colors.text.quaternary,
      marginTop: spacing.sm,
    },
  });
