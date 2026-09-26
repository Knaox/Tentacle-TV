import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useInterfaceLanguage, useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import { SettingsChoiceRow } from "../settings/SettingsChoiceRow";

/**
 * La langue d'interface, en ligne : « Langue [Français | Anglais] ».
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
      options={[{ value: "fr", label: t("french") }, { value: "en", label: t("english") }]}
      value={currentLang}
      onChange={switchLanguage}
      last={last}
    />
  );
}
