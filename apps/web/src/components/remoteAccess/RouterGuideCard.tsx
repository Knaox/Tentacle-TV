import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { ROUTER_GUIDES, ROUTER_GUIDES_VERIFIED_ON, routerGuide, routerGuideUrl, type RouterGuide } from "@tentacle-tv/shared";
import { AdminNotice } from "../admin/kit";
import { cls } from "../../pages/adminUtils";

const OTHER = "other";
const linkCls = "inline-flex items-center gap-1 font-semibold text-content-primary underline underline-offset-4 hover:opacity-80";

/**
 * La box : l'opérateur choisi (gardé dans les réglages), son guide officiel
 * dans la langue de l'interface, l'adresse de l'interface, le chemin des menus
 * tel que la box l'écrit, et ce qu'il faut savoir de son IPv6 et de son IPv4.
 */
export function RouterGuideCard({ routerId, onChange }: { routerId: string | null; onChange: (id: string | null) => void }) {
  const { t, i18n } = useTranslation("remoteAccess");
  const selectId = useId();
  const guide = routerGuide(routerId);
  const value = guide ? guide.id : routerId === OTHER ? OTHER : "";

  return (
    <div className="rounded-xl border border-line-subtle bg-fill-faint p-4">
      <h3 className="text-sm font-semibold text-content-primary">{t("routerTitle")}</h3>
      <label htmlFor={selectId} className={`${cls.lbl} mt-3`}>
        {t("routerChoose")}
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className={`${cls.inp} max-w-sm cursor-pointer`}
      >
        <option value="">{t("routerNone")}</option>
        {(["CH", "FR"] as const).map((country) => (
          <optgroup key={country} label={t(`country${country}`)}>
            {ROUTER_GUIDES.filter((g) => g.country === country).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.box}
              </option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER}>{t("routerOther")}</option>
      </select>

      {value === OTHER ? <p className="mt-3 text-sm leading-relaxed text-content-secondary">{t("routerOtherBody")}</p> : null}
      {guide ? <GuideDetails guide={guide} lang={i18n.language} /> : null}
    </div>
  );
}

function GuideDetails({ guide, lang }: { guide: RouterGuide; lang: string }) {
  const { t } = useTranslation("remoteAccess");
  const url = routerGuideUrl(guide, lang);
  const date = new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(ROUTER_GUIDES_VERIFIED_ON));

  return (
    <div className="mt-4 space-y-3 text-sm leading-relaxed text-content-secondary">
      {!guide.verified ? <AdminNotice tone="warning">{t("routerUnverified", { name: guide.name })}</AdminNotice> : null}
      {url ? (
        <p>
          <a href={url} target="_blank" rel="noopener noreferrer" className={linkCls}>
            {t("routerGuideLink", { name: guide.name })}
            <ExternalLink size={14} aria-hidden="true" />
          </a>
          {!guide.stepByStep ? <span className="mt-1 block text-xs text-content-tertiary">{t("routerBestPage")}</span> : null}
        </p>
      ) : null}
      {guide.adminUrls.length > 0 ? <p>{t("routerAdmin", { urls: guide.adminUrls.join(" · ") })}</p> : null}
      {guide.menuPaths.map((path) => (
        <p key={path.text}>
          {path.box ? <span className="font-semibold text-content-primary">{path.box} — </span> : null}
          {t("routerMenu")}{" "}
          <span lang={path.lang} className="font-mono text-content-primary">
            {path.text}
          </span>
        </p>
      ))}
      <p>{t(`router_${guide.id}_note`)}</p>
      {guide.sharedIpv4.remedy ? (
        <AdminNotice tone="warning">
          {t(`sharedIpv4_${guide.sharedIpv4.remedy}`, { name: guide.name })}{" "}
          {guide.sharedIpv4.source ? (
            <a href={guide.sharedIpv4.source} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {t("sourceLink")}
            </a>
          ) : null}
        </AdminNotice>
      ) : null}
      <div>
        <p className="font-semibold text-content-primary">{t("ipv6Title")}</p>
        <p className="mt-1">
          {t("ipv6Body")} {guide.ipv6.inboundBlocked ? t("ipv6Blocked", { name: guide.name }) : null}
        </p>
      </div>
      {guide.verified ? <p className="text-xs text-content-quaternary">{t("routerVerified", { date })}</p> : null}
    </div>
  );
}
