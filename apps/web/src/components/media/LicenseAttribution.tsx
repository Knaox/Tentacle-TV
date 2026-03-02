import { useTranslation } from "react-i18next";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaLicense } from "../../hooks/useMediaLicense";

const ROLE_I18N_KEYS: Record<string, string> = {
  Director: "media:licenseDirector",
  Producer: "media:licenseProducer",
  "Executive Producer": "media:licenseExecutiveProducer",
  "Concept Art": "media:licenseConceptArt",
  Studio: "media:licenseStudio",
};

interface LicenseAttributionProps {
  item: MediaItem;
}

export function LicenseAttribution({ item }: LicenseAttributionProps) {
  const { t } = useTranslation("media");
  const license = useMediaLicense(item);

  if (!license) return null;

  return (
    <section className="mx-4 mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:mx-12">
      {/* Header */}
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white/90">
        <LicenseIcon />
        {t("media:licenseTitle")}
      </h3>

      {/* License badge & name */}
      <div className="mb-4">
        <a
          href={license.license.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex flex-col gap-2"
        >
          {license.license.badgeUrl && (
            <img
              src={license.license.badgeUrl}
              alt={license.license.fullName}
              className="h-[31px] w-[88px] transition-opacity group-hover:opacity-80"
            />
          )}
          <span className="text-sm font-medium text-tentacle-accent-light transition-colors group-hover:text-tentacle-accent">
            {license.license.fullName}
          </span>
        </a>
      </div>

      {/* Creators */}
      {license.attribution.creators.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-8 gap-y-2">
          {license.attribution.creators.map((creator) => (
            <div key={`${creator.role}-${creator.name}`}>
              <p className="text-xs font-medium text-white/40">
                {ROLE_I18N_KEYS[creator.role] ? t(ROLE_I18N_KEYS[creator.role]) : creator.role}
              </p>
              <p className="mt-0.5 text-sm text-white/80">
                {creator.url ? (
                  <a
                    href={creator.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-tentacle-accent-light transition-colors hover:text-tentacle-accent"
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
      <div className="mb-3">
        <p className="text-xs font-medium text-white/40">{t("media:licenseSource")}</p>
        <a
          href={license.attribution.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1 text-sm text-tentacle-accent-light transition-colors hover:text-tentacle-accent"
        >
          {license.attribution.sourceName}
          <ExternalLinkIcon />
        </a>
      </div>

      {/* Modifications */}
      {license.modifications && (
        <div className="mb-3">
          <p className="text-xs font-medium text-white/40">{t("media:licenseModifications")}</p>
          <p className="mt-0.5 text-sm text-white/60">{license.modifications}</p>
        </div>
      )}

      {/* Copyright notice */}
      <p className="text-xs text-white/40">{license.attribution.copyrightNotice}</p>
    </section>
  );
}

function LicenseIcon() {
  return (
    <svg className="h-5 w-5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" d="M10 9.5a2.5 2.5 0 11 0 5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m4-3h6v6m-11 5L21 3" />
    </svg>
  );
}
