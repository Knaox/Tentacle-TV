import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Shield } from "lucide-react";
import type { MediaItem } from "@tentacle-tv/shared";
import { useMediaLicense } from "../../../hooks/useMediaLicense";

const ROLE_I18N_KEYS: Record<string, string> = {
  Director: "media:licenseDirector",
  Producer: "media:licenseProducer",
  "Executive Producer": "media:licenseExecutiveProducer",
  "Concept Art": "media:licenseConceptArt",
  Studio: "media:licenseStudio",
};

const LABEL = "text-[11px] font-bold uppercase tracking-[0.5px] text-content-tertiary";

/**
 * `LicenseAttribution` de l'app : la carte des œuvres sous licence libre —
 * marges 16, 16 au-dessus, 640 au plus, rayon 12, filet `border.subtle`, fond
 * `fill.faint`, padding 12. Badge 88 × 31, nom de licence 13 en violet clair,
 * créateurs, source, modifications, mention de droits 11.
 */
export const LicenseAttribution = memo(function LicenseAttribution({ item }: { item: MediaItem }) {
  const { t } = useTranslation("media");
  const license = useMediaLicense(item);
  if (!license) return null;
  const { attribution } = license;

  return (
    <div className="mx-4 mt-4 max-w-[640px] rounded-xl border border-line-subtle bg-fill-faint p-3">
      <div className="mb-3 flex items-center gap-2">
        <Shield size={18} className="text-content-secondary" aria-hidden />
        <h3 className="text-[16px] font-bold tracking-[-0.4px]" style={{ color: "color-mix(in srgb, var(--text-primary) 90%, transparent)" }}>{t("media:licenseTitle")}</h3>
      </div>

      <a href={license.license.url} target="_blank" rel="noopener noreferrer" className="mb-3 block">
        {license.license.badgeUrl && (
          <img src={license.license.badgeUrl} alt="" loading="lazy" className="mb-1.5 object-contain" style={{ width: 88, height: 31 }} />
        )}
        <span className="text-[13px] font-medium text-brand-light">{license.license.fullName}</span>
      </a>

      {attribution.creators.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-3">
          {attribution.creators.map((creator) => (
            <div key={`${creator.role}-${creator.name}`} className="min-w-[100px]">
              <p className={LABEL}>{ROLE_I18N_KEYS[creator.role] ? t(ROLE_I18N_KEYS[creator.role]) : creator.role}</p>
              {creator.url ? (
                <a href={creator.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[13px] text-brand-light">
                  {creator.name}
                </a>
              ) : (
                <p className="mt-0.5 text-[13px] text-content-secondary">{creator.name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {attribution.sourceUrl ? (
        <a href={attribution.sourceUrl} target="_blank" rel="noopener noreferrer" className="mb-2 block">
          <span className={`block ${LABEL}`}>{t("media:licenseSource")}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[13px] text-brand-light">
            {attribution.sourceName || attribution.sourceUrl}
            <ExternalLink size={12} aria-hidden />
          </span>
        </a>
      ) : null}

      {license.modifications && (
        <div className="mb-2">
          <p className={LABEL}>{t("media:licenseModifications")}</p>
          <p className="mt-0.5 text-[13px] text-content-secondary">{license.modifications}</p>
        </div>
      )}

      <p className="mt-1 text-[11px] font-bold tracking-[0.3px] text-content-tertiary">{attribution.copyrightNotice}</p>
    </div>
  );
});
