import { useTranslation } from "react-i18next";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { ScalesIcon } from "@phosphor-icons/react/dist/csr/Scales";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaLicense } from "../../hooks/useMediaLicense";
import { externalLinkHandler } from "../../lib/openExternal";

const ROLE_I18N_KEYS: Record<string, string> = {
  Director: "media:licenseDirector",
  Producer: "media:licenseProducer",
  "Executive Producer": "media:licenseExecutiveProducer",
  "Concept Art": "media:licenseConceptArt",
  Studio: "media:licenseStudio",
};

/** Un lien du panneau : la teinte franche, souligné au survol (la couleur seule ne dit pas « lien »). */
const LINK = "text-accent underline-offset-4 hover:underline";
const LABEL = "ui-eyebrow";

interface LicenseAttributionProps {
  item: MediaItem;
}

export function LicenseAttribution({ item }: LicenseAttributionProps) {
  const { t } = useTranslation("media");
  const license = useMediaLicense(item);

  if (!license) return null;

  return (
    // Un panneau du socle (une teinte, pas un liseré), aligné sur la gouttière des rangées.
    <div className="row-gutter mt-6">
    <section className="ui-panel p-5 md:p-6">
      {/* Header */}
      <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-content-primary">
        <ScalesIcon className="h-5 w-5 text-content-tertiary" aria-hidden />
        {t("media:licenseTitle")}
      </h3>

      {/* License badge & name */}
      <div className="mb-4">
        <a
          href={license.license.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={externalLinkHandler(license.license.url)}
          className="group inline-flex flex-col gap-2"
        >
          {license.license.badgeUrl && (
            <img
              src={license.license.badgeUrl}
              alt={license.license.fullName}
              className="h-[31px] w-[88px] transition-opacity duration-hover group-hover:opacity-80"
            />
          )}
          <span className={`text-sm font-medium ${LINK}`}>
            {license.license.fullName}
          </span>
        </a>
      </div>

      {/* Creators */}
      {license.attribution.creators.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-8 gap-y-2">
          {license.attribution.creators.map((creator) => (
            <div key={`${creator.role}-${creator.name}`}>
              <p className={LABEL}>
                {ROLE_I18N_KEYS[creator.role] ? t(ROLE_I18N_KEYS[creator.role]) : creator.role}
              </p>
              <p className="mt-0.5 text-sm text-content-secondary">
                {creator.url ? (
                  <a
                    href={creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={externalLinkHandler(creator.url)}
                    className={LINK}
                  >
                    {creator.name}
                  </a>
                ) : (
                  creator.name
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Source */}
      {license.attribution.sourceUrl && (
        <div className="mb-3">
          <p className={LABEL}>{t("media:licenseSource")}</p>
          <a
            href={license.attribution.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={externalLinkHandler(license.attribution.sourceUrl)}
            className={`mt-0.5 inline-flex items-center gap-1 text-sm ${LINK}`}
          >
            {license.attribution.sourceName || license.attribution.sourceUrl}
            <ArrowSquareOutIcon className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      )}

      {/* Modifications */}
      {license.modifications && (
        <div className="mb-3">
          <p className={LABEL}>{t("media:licenseModifications")}</p>
          <p className="mt-0.5 text-sm text-content-tertiary">{license.modifications}</p>
        </div>
      )}

      {/* Copyright notice */}
      <p className="text-xs text-content-quaternary">{license.attribution.copyrightNotice}</p>
    </section>
    </div>
  );
}
