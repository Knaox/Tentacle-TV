import { useTranslation } from "react-i18next";
import { Globe, Sun } from "lucide-react";
import type { ThemeMode } from "@tentacle-tv/theme";
import type { SettingScope } from "@tentacle-tv/shared";
import { useThemeMode } from "../../../theme/useThemeMode";
import { useInterfaceLanguage } from "../../../components/settings/useInterfaceLanguage";
import { SettingsChoiceRow } from "../settings/ui/SettingsChoiceRow";

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];
const MODE_KEYS: Record<ThemeMode, string> = { light: "themeLight", dark: "themeDark", auto: "themeAuto" };

/**
 * `ThemeChoiceRow` de l'app : « Thème [Clair | Sombre | Auto] », réglage par
 * appareil — le même magasin que la page web Apparence (`useThemeMode`).
 */
export function ThemeChoiceRow({ scope, last }: { scope?: SettingScope | null; last?: boolean } = {}) {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  return (
    <SettingsChoiceRow
      icon={Sun}
      label={t("theme")}
      options={MODES.map((value) => ({ value, label: t(MODE_KEYS[value]) }))}
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
      scope={scope}
      last={last}
    />
  );
}

/**
 * `LanguageChoiceRow` de l'app : « Langue [Français | Anglais] ». Le geste est
 * le seul `useInterfaceLanguage` : langue locale aussitôt, envoi au serveur en
 * ligne, file d'attente hors ligne.
 */
export function LanguageChoiceRow({ last, scope, label }: { last?: boolean; scope?: SettingScope | null; label?: string }) {
  const { t } = useTranslation("profile");
  const { language, setLanguage } = useInterfaceLanguage();

  return (
    <SettingsChoiceRow
      icon={Globe}
      label={label ?? t("language")}
      options={[{ value: "fr", label: t("french") }, { value: "en", label: t("english") }]}
      value={language}
      onChange={setLanguage}
      last={last}
      scope={scope}
    />
  );
}
