import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";
import { remoteVerdict, type RemoteCheckItem, type RemoteCheckReport, type RemoteServiceVerdict } from "@tentacle-tv/shared";
import { AdminNotice, StatusPill, type StatusTone } from "../admin/kit";

const TONE: Record<RemoteServiceVerdict["tone"], StatusTone> = { success: "success", danger: "error", warning: "warning", neutral: "neutral" };

/** Le rapport du test : par service, l'état en mots (jamais la couleur seule), chaque essai, et la cause probable. */
export const CheckResults = memo(function CheckResults({ report, wanIp }: { report: RemoteCheckReport; wanIp: string }) {
  const { t, i18n } = useTranslation("remoteAccess");
  const verdict = useMemo(() => remoteVerdict(report, wanIp.trim() || null), [report, wanIp]);
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.checkedAt));

  if (report.outcome !== "done") {
    return <AdminNotice tone={report.outcome === "service_unavailable" ? "info" : "warning"}>{t(`outcome_${report.outcome}`)}</AdminNotice>;
  }

  return (
    <div className="space-y-4">
      {verdict.services.map((service) => (
        <ServiceCard key={service.service} verdict={service} lang={i18n.language} publicIp={report.publicIp} />
      ))}
      <div className="space-y-0.5 text-xs text-content-quaternary">
        {report.publicIp.v4 ? <p>{t("publicIpV4", { ip: report.publicIp.v4 })}</p> : null}
        {report.publicIp.v6 ? <p>{t("publicIpV6", { ip: report.publicIp.v6 })}</p> : null}
        <p>{t("lastChecked", { date: when })}</p>
      </div>
    </div>
  );
});

function ServiceCard({ verdict, lang, publicIp }: { verdict: RemoteServiceVerdict; lang: string; publicIp: RemoteCheckReport["publicIp"] }) {
  const { t } = useTranslation("remoteAccess");
  return (
    <section
      aria-label={t(`service_${verdict.service}`)}
      className={`rounded-xl border p-4 ${verdict.tone === "danger" ? "border-danger-border bg-status-error-bg" : "border-line-subtle bg-fill-faint"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-content-primary">{t(`service_${verdict.service}`)}</h3>
        <StatusPill tone={TONE[verdict.tone]} size="sm">
          {t(`state_${verdict.state}`)}
        </StatusPill>
      </div>
      <p className={`mt-1.5 text-sm leading-relaxed ${verdict.tone === "danger" ? "text-status-error-fg" : "text-content-secondary"}`}>
        {t(`stateBody_${verdict.state}`)}
      </p>
      {verdict.items.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {verdict.items.map((item) => (
            <ItemLine key={`${item.family}-${item.scheme}-${item.port}-${item.host ?? ""}`} item={item} lang={lang} publicIp={publicIp} />
          ))}
        </ul>
      ) : null}
      {verdict.causes.length > 0 ? (
        <div className="mt-3 border-t border-line-subtle pt-3">
          <p className="text-xs font-medium text-content-tertiary">{t("causesTitle")}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-content-secondary">
            {verdict.causes.map((cause) => (
              <li key={cause}>{t(`cause_${cause}`)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ItemLine({ item, lang, publicIp }: { item: RemoteCheckItem; lang: string; publicIp: RemoteCheckReport["publicIp"] }) {
  const { t } = useTranslation("remoteAccess");
  const ok = item.verdict === "open" || item.verdict === "redirect";
  const Icon = ok ? CircleCheck : item.verdict === "not_testable" ? CircleMinus : CircleAlert;
  const color = ok ? "text-status-success-fg" : item.verdict === "not_testable" ? "text-content-tertiary" : "text-status-warning-fg";
  // Sans domaine, l'adresse nue : celle que le service a vue pour cette famille.
  const bare = item.family === 4 ? publicIp.v4 : publicIp.v6 ? `[${publicIp.v6}]` : null;
  const where = `${item.scheme}://${item.host ?? bare ?? "…"}:${item.port}`;
  const expires = item.certificateExpires
    ? t("certExpires", { date: new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(item.certificateExpires)) })
    : null;
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${color}`} />
      <span className="min-w-0">
        <span className="font-medium text-content-primary">{t(`family_${item.family}`)}</span>{" "}
        <span className="break-all font-mono text-xs text-content-tertiary">{where}</span>
        <span className="block text-content-secondary">
          {t(`verdict_${item.verdict}`, { status: item.httpStatus ?? "" })}
          {expires ? ` · ${expires}` : ""}
        </span>
      </span>
    </li>
  );
}
