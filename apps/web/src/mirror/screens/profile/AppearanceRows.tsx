import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, Sun } from "lucide-react";
import { useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import type { ThemeMode } from "@tentacle-tv/theme";
import { useThemeMode } from "../../../theme/useThemeMode";
import { clearPendingInterfaceLanguage, markInterfaceLanguagePending } from "../../../offline/pendingPrefs";
import { useOfflineMode } from "../../../offline/useOfflineMode";
import { SettingsChoiceRow } from "../settings/ui/SettingsChoiceRow";

const MODES: readonly ThemeMode[] = ["light", "dark", "auto"];
const MODE_KEYS: Record<ThemeMode, string> = { light: "themeLight", dark: "themeDark", auto: "themeAuto" };

/**
 * `ThemeChoiceRow` de l'app : « Thème [Clair | Sombre | Auto] », réglage par
 * appareil — le même magasin que la page web Apparence (`useThemeMode`).
 */
export function ThemeChoiceRow() {
  const { t } = useTranslation("preferences");
  const { mode, setMode } = useThemeMode();
  return (
    <SettingsChoiceRow
      icon={Sun}
      label={t("theme")}
      options={MODES.map((value) => ({ value, label: t(MODE_KEYS[value]) }))}
      value={mode}
      onChange={(value) => setMode(value as ThemeMode)}
    />
  );
}

/**
 * `LanguageChoiceRow` de l'app : « Langue [Français | Anglais] ». Le geste est
 * celui de la page Lecture du web (`pages/Preferences.tsx`) : langue locale
 * aussitôt, envoi au serveur en ligne, file d'attente hors ligne.
 */
export function LanguageChoiceRow({ last }: { last?: boolean }) {
  const { t, i18n } = useTranslation("profile");
  const queryClient = useQueryClient();
  const offline = useOfflineMode();
  const setLang = useSetInterfaceLanguage();
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";

  const change = useCallback((lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem("tentacle_language", lng);
    if (offline) {
      markInterfaceLanguagePending(lng);
    } else {
      clearPendingInterfaceLanguage();
      setLang.mutate(lng);
    }
    void queryClient.invalidateQueries();
  }, [i18n, offline, setLang, queryClient]);

  return (
    <SettingsChoiceRow
      icon={Globe}
      label={t("language")}
      options={[{ value: "fr", label: t("french") }, { value: "en", label: t("english") }]}
      value={current}
      onChange={change}
      last={last}
    />
  );
}
