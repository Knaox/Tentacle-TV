import { useTranslation } from "react-i18next";
import { useThemeMode, type ThemeMode } from "@/theme";
import { SettingsChoiceRow } from "./SettingsChoiceRow";

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];

export const THEME_MODE_LABEL_KEYS: Record<ThemeMode, string> = {
  light: "themeLight",
  dark: "themeDark",
  auto: "themeAuto",
};

/**
 * Le thème, en ligne : « Thème [Clair | Sombre | Auto] ». "Auto" suit le
 * réglage système en live via Appearance ; le choix est persisté par
 * appareil (tentacle_theme_mode, voir ThemeProvider).
 */
export function ThemeChoiceRow({ last }: { last?: boolean }) {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  return (
    <SettingsChoiceRow
      icon="sun"
      label={t("theme")}
      options={MODES.map((value) => ({ value, label: t(THEME_MODE_LABEL_KEYS[value]) }))}
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
      last={last}
    />
  );
}
