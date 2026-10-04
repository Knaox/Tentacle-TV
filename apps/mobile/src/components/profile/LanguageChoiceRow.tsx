import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useInterfaceLanguage, useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import { SettingsChoiceRow } from "../settings/SettingsChoiceRow";

/** Chaque langue sous SON nom, comme sur l'Apple TV : qui cherche l'anglais lit « English ». */
const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

/**
 * La langue d'interface : « Langue », puis une pastille par langue.
 * Synchronisée avec le backend (DB), comme sur web/TV : reflète la langue
 * stockée côté serveur (changée depuis un autre appareil) et la persiste au
 * changement.
 */
export function LanguageChoiceRow({ last }: { last?: boolean }) {
  const { t, i18n } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const { data: dbLang } = useInterfaceLanguage();
  const setLangMut = useSetInterfaceLanguage();

  // Reflète la langue en base (source de vérité inter-appareils).
  useEffect(() => {
    const lang = dbLang?.language;
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
      storage.setItem("tentacle_language", lang);
    }
  }, [dbLang?.language, i18n, storage]);

  const currentLang = i18n.language?.startsWith("fr") ? "fr" : "en";
  const switchLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
    setLangMut.mutate(lng); // persiste en DB → suit sur les autres appareils
  };

  return (
    <SettingsChoiceRow
      icon="globe"
      label={t("language")}
      options={LANGUAGES}
      value={currentLang}
      onChange={switchLanguage}
      last={last}
    />
  );
}
