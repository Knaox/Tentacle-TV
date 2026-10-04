import { useTranslation } from "react-i18next";
import { useThemeMode } from "@/theme";
import { SettingsChoiceRow } from "./SettingsChoiceRow";
import { ThemePreviewTiles } from "./ThemePreviewTiles";

export { THEME_MODE_LABEL_KEYS } from "./themeModeLabels";

/**
 * Le thème : « Thème », puis ses trois aperçus — Clair, Sombre, Auto.
 * "Auto" suit le réglage système en live via Appearance (dit sous le nom) ;
 * le choix est persisté par appareil (tentacle_theme_mode, voir
 * ThemeProvider).
 */
export function ThemeChoiceRow({ last }: { last?: boolean }) {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  return (
    <SettingsChoiceRow icon="sun" label={t("theme")} description={mode === "auto" ? t("themeAutoHint") : undefined} last={last}>
      <ThemePreviewTiles value={mode} onChange={setMode} />
    </SettingsChoiceRow>
  );
}
