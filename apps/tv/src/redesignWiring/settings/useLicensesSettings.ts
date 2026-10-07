import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LICENSE_TEXT_TITLES, componentBlock, componentsFor, componentsUnder, licenseTextsFor,
  splitLicenseText, tentacleSourceUrl,
} from "@tentacle-tv/shared/licenses";
import { LICENSE_TEXTS } from "@tentacle-tv/shared/licenses/texts";
import { PLATFORM_TRAITS } from "../../platform/traits";
import type { LicenseReaderModel, SettingsLicenses } from "../../redesign/screens/settings/settingsTypes";

/**
 * L'onglet « Licences » des deux téléviseurs : la mention de l'AGPL, la
 * source au tag `tv-vX.Y.Z`, et les documents — les composants tiers de la
 * plateforme (trait `licensePlatform`), puis chaque texte qui s'y applique.
 * Un document ouvert se découpe en blocs À L'OUVERTURE seulement : rien
 * n'est préparé pour les textes qu'on ne lit pas.
 */
export function useLicensesSettings(version: string) {
  const { t } = useTranslation("about");
  const platform = PLATFORM_TRAITS.licensePlatform;
  const [reader, setReader] = useState<LicenseReaderModel | null>(null);
  const texts = useMemo(() => licenseTextsFor(platform), [platform]);

  const licenses = useMemo<SettingsLicenses>(() => ({
    statement: t("about:tentacleLicense", { version }),
    sourceUrl: tentacleSourceUrl(platform, version),
    documents: [
      { title: t("about:thirdPartyTitle"), caption: t("about:licenseUsedBy", { count: componentsFor(platform).length }) },
      ...texts.map((id) => {
        const count = componentsUnder(platform, id).length;
        return { title: LICENSE_TEXT_TITLES[id], caption: count > 0 ? t("about:licenseUsedBy", { count }) : t("about:licenseTentacle") };
      }),
    ],
  }), [t, version, platform, texts]);

  const openLicense = useCallback((index: number) => {
    if (index === 0) {
      setReader({ title: t("about:thirdPartyTitle"), blocks: componentsFor(platform).map(componentBlock) });
      return;
    }
    const id = texts[index - 1];
    if (id) setReader({ title: LICENSE_TEXT_TITLES[id], blocks: splitLicenseText(LICENSE_TEXTS[id]) });
  }, [t, platform, texts]);

  const closeReader = useCallback(() => setReader(null), []);
  return { licenses, reader, openLicense, closeReader };
}
