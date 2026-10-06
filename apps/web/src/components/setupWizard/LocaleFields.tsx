import { useId } from "react";
import { useTranslation } from "react-i18next";
import { cls } from "../../pages/adminUtils";
import { METADATA_COUNTRIES, METADATA_LANGUAGES, type WizardLocale } from "./wizardModel";

/**
 * La langue et le pays des métadonnées, proposés d'office d'après le
 * navigateur. Plus un écran à part : deux listes sous le compte, que l'on ne
 * touche que si la proposition ne convient pas.
 */
export function LocaleFields({ locale, onChange }: { locale: WizardLocale; onChange: (next: WizardLocale) => void }) {
  const { t } = useTranslation("setupWizard");
  const langId = useId();
  const countryId = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-content-primary">{t("localeTitle")}</legend>
      <p className="text-xs text-content-tertiary">{t("localeSubtitle")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={langId} className={cls.lbl}>{t("localeLanguage")}</label>
          <select id={langId} value={locale.language} onChange={(e) => onChange({ ...locale, language: e.target.value })} className={`${cls.inp} cursor-pointer`}>
            {METADATA_LANGUAGES.map((code) => (
              <option key={code} value={code} lang={code}>
                {t(`lang_${code}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={countryId} className={cls.lbl}>{t("localeCountry")}</label>
          <select id={countryId} value={locale.country} onChange={(e) => onChange({ ...locale, country: e.target.value })} className={`${cls.inp} cursor-pointer`}>
            {METADATA_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {t(`country_${code}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}
