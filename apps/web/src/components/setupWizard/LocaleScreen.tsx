import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { cls } from "../../pages/adminUtils";
import { setupApi, SetupApiError, type WizardErrorCode } from "./setupApi";
import { SetupErrorLine } from "./SetupErrorLine";
import type { Wizard } from "./useWizard";
import { METADATA_COUNTRIES, METADATA_LANGUAGES, uiCultureOf } from "./wizardModel";
import { WizardFrame } from "./WizardFrame";

/**
 * La langue et le pays des métadonnées. Pour un Jellyfin vierge, c'est ici
 * qu'il est configuré : son propre assistant, mené par l'API, avec le compte
 * choisi à l'écran précédent et cette langue.
 */
export function LocaleScreen({ wizard }: { wizard: Wizard }) {
  const { t } = useTranslation("setupWizard");
  const langId = useId();
  const countryId = useId();
  const [locale, setLocale] = useState(wizard.data.locale);
  const [error, setError] = useState<WizardErrorCode | null>(null);
  const [pending, setPending] = useState(false);
  const initializing = wizard.data.mode === "initialize" && !wizard.data.context?.jellyfin.configured;

  const submit = async () => {
    setError(null);
    wizard.patch({ locale });
    if (!initializing) {
      wizard.next();
      return;
    }
    const credentials = wizard.data.credentials;
    if (!credentials) return wizard.back?.();
    setPending(true);
    try {
      await setupApi.initialize({
        url: wizard.data.jellyfinUrl,
        username: credentials.username,
        password: credentials.password,
        uiCulture: uiCultureOf(locale.language),
        metadataLanguage: locale.language,
        metadataCountry: locale.country,
      });
      wizard.patch({ context: await setupApi.context() });
      wizard.next();
    } catch (err) {
      setError(err instanceof SetupApiError ? err.code : "internal");
    } finally {
      setPending(false);
    }
  };

  return (
    <WizardFrame title={t("localeTitle")} subtitle={t("localeSubtitle")} position={wizard.position} total={wizard.total} onBack={wizard.back}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={langId} className={cls.lbl}>{t("localeLanguage")}</label>
            <select id={langId} value={locale.language} onChange={(e) => setLocale((l) => ({ ...l, language: e.target.value }))} className={`${cls.inp} cursor-pointer`}>
              {METADATA_LANGUAGES.map((code) => (
                <option key={code} value={code} lang={code}>
                  {t(`lang_${code}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={countryId} className={cls.lbl}>{t("localeCountry")}</label>
            <select id={countryId} value={locale.country} onChange={(e) => setLocale((l) => ({ ...l, country: e.target.value }))} className={`${cls.inp} cursor-pointer`}>
              {METADATA_COUNTRIES.map((code) => (
                <option key={code} value={code}>
                  {t(`country_${code}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <SetupErrorLine code={error} onRetry={error ? () => void submit() : undefined} />
        <button type="button" onClick={() => void submit()} disabled={pending} className={`${cls.bp} w-full sm:w-auto`}>
          {pending ? t("working") : initializing ? t("localePrepare") : t("next")}
        </button>
      </div>
    </WizardFrame>
  );
}
