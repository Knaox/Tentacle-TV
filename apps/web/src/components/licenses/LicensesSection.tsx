import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LICENSE_TEXT_TITLES, componentsFor, componentsUnder, licenseTextsFor, tentacleSourceUrl,
  type LicensePlatform, type LicenseTextId, type ThirdPartyComponent,
} from "@tentacle-tv/shared/licenses";
import { externalLinkHandler } from "../../lib/openExternal";
import { LicenseTextModal } from "./LicenseTextModal";

/**
 * « Licences » : la mention de l'AGPL (copyright, absence de garantie, source
 * de CETTE version), les composants tiers de la plateforme — et, sur le web,
 * ceux du serveur qui le sert —, puis les textes complets, lisibles hors ligne.
 */
export const LicensesSection = memo(function LicensesSection({ platform, version }: { platform: LicensePlatform; version: string }) {
  const { t } = useTranslation("about");
  const [open, setOpen] = useState<LicenseTextId | null>(null);
  const sourceUrl = tentacleSourceUrl(platform, version);
  const groups = useMemo(() => {
    const own = componentsFor(platform);
    return platform === "web" ? [own, componentsFor("server")] : [own];
  }, [platform]);
  const texts = useMemo(() => {
    const ids = new Set(licenseTextsFor(platform));
    if (platform === "web") for (const id of licenseTextsFor("server")) ids.add(id);
    return Object.keys(LICENSE_TEXT_TITLES).filter((id) => ids.has(id as LicenseTextId)) as LicenseTextId[];
  }, [platform]);

  return (
    <section aria-labelledby="licenses-title">
      <h2 id="licenses-title" className="mt-10 text-lg font-semibold text-content-primary">{t("about:licensesTitle")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-content-tertiary">{t("about:tentacleLicense", { version })}</p>
      <p className="mt-2 text-sm text-content-tertiary">{t("about:sourceCode")}</p>
      <p className="text-sm">
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" onClick={externalLinkHandler(sourceUrl)}
          className="break-all text-[var(--brand)] hover:underline">{sourceUrl}</a>
      </p>

      <h3 className="mt-8 text-base font-semibold text-content-primary">{t("about:thirdPartyTitle")}</h3>
      {groups.map((list, i) => (
        <div key={i} className="mt-3">
          {i > 0 ? <p className="mb-1 text-xs font-medium uppercase tracking-wide text-content-quaternary">Tentacle TV Server</p> : null}
          <ul className="divide-y divide-line-subtle">
            {list.map((c) => <ComponentRow key={`${c.name}-${c.version ?? ""}`} component={c} />)}
          </ul>
        </div>
      ))}

      <h3 className="mt-8 text-base font-semibold text-content-primary">{t("about:licenseTextsTitle")}</h3>
      <ul className="mt-3 divide-y divide-line-subtle">
        {texts.map((id) => {
          const count = componentsUnder(platform, id).length + (platform === "web" ? componentsUnder("server", id).length : 0);
          return (
            <li key={id}>
              <button type="button" onClick={() => setOpen(id)}
                className="flex w-full items-center justify-between gap-4 py-2.5 text-left">
                <span className="text-sm font-medium text-[var(--brand)] hover:underline">{LICENSE_TEXT_TITLES[id]}</span>
                <span className="shrink-0 text-xs text-content-quaternary">
                  {count > 0 ? t("about:licenseUsedBy", { count }) : t("about:licenseTentacle")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <LicenseTextModal id={open} onClose={() => setOpen(null)} />
    </section>
  );
});

function ComponentRow({ component: c }: { component: ThirdPartyComponent }) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-content-secondary">
          {c.name}{c.version ? <span className="text-content-quaternary"> {c.version}</span> : null}
        </span>
        <span className="shrink-0 text-xs text-content-tertiary">{c.license}</span>
      </div>
      {c.notice ? <p className="text-xs text-content-quaternary">{c.notice}</p> : null}
      {c.note ? <p className="text-xs text-content-quaternary">{c.note}</p> : null}
      <p className="break-all text-xs text-content-disabled">{c.source}</p>
    </li>
  );
}
