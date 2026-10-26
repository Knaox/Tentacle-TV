/**
 * Octave — Réglages d'Octave › « Langue » : la langue de l'interface, LA même que Réglages de Tentacle (réglage du
 * compte, `useInterfaceLanguage` : aucune copie d'état ni du geste). Les langues se disent dans leur propre langue.
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
import { SegmentedChoice } from "../../../components/settings/SegmentedChoice";
import { INTERFACE_LANGUAGE_CODES, useInterfaceLanguage, type InterfaceLanguageCode } from "../../../components/settings/useInterfaceLanguage";

/** Le nom de chaque langue dans cette langue (endonyme) : on reconnaît la sienne quelle que soit celle affichée. */
const ENDONYMS: Record<InterfaceLanguageCode, string> = { fr: "Français", en: "English" };
const OPTIONS = INTERFACE_LANGUAGE_CODES.map((value) => ({ value, label: ENDONYMS[value] }));

export function LanguageSetting({ badge }: { badge?: ReactNode }) {
  const { t } = useTranslation("octaveShell");
  const { language, setLanguage } = useInterfaceLanguage();
  return (
    <SettingsSection title={t("settings.language")} caption={t("settings.languageCaption")} badge={badge}>
      <div className="p-5">
        <p className="mb-2 text-sm font-medium text-content-primary">{t("settings.languageLabel")}</p>
        <SegmentedChoice label={t("settings.languageLabel")} value={language} options={OPTIONS} onChange={setLanguage} />
      </div>
    </SettingsSection>
  );
}
