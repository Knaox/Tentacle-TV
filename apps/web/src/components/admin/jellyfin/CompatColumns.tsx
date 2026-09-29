import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { CompatVersionView, JellyfinCompatReport } from "@tentacle-tv/shared";
import { StatusPill } from "../kit";
import {
  COMPAT_LABEL,
  COMPAT_TONE,
  INSTALLED_FAILURE_KEY,
  explainVerdict,
  formatDay,
  gapsOf,
  latestSituation,
  localized,
  probeSummary,
} from "./compatPresentation";

/**
 * Les deux colonnes de la compatibilité — la version installée, la dernière
 * publiée —, les mêmes dans la vue d'ensemble et dans Services. Chacune dit
 * son verdict en mot ET en couleur, pourquoi, et ce qui manque ; l'installée
 * ajoute ce que les sondes ont confirmé sur CE serveur, la dernière sa date et
 * ses notes de version.
 */

const GAPS_SHOWN = 3;

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-fill-subtle px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">{label}</p>
      <div className="mt-1.5 space-y-2">{children}</div>
    </div>
  );
}

/** Le verdict d'une version : titre, puce, explication, manques, et l'avertissement Tentacle trop ancien. */
function Verdict({ view, badge }: { view: CompatVersionView; badge?: ReactNode }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const explanation = explainVerdict(view, i18n.language);
  const nested = Object.fromEntries(Object.entries(explanation.nested ?? {}).map(([name, key]) => [name, t(key)]));
  const gaps = gapsOf(view);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <p className="text-lg font-semibold text-content-primary">{t("compatVersion", { version: view.version })}</p>
        <StatusPill tone={COMPAT_TONE[view.status]} size="sm">{t(COMPAT_LABEL[view.status])}</StatusPill>
        {badge}
      </div>
      <p className="text-sm leading-relaxed text-content-secondary">{t(explanation.key, { ...explanation.values, ...nested })}</p>
      {gaps.length > 0 && (
        <ul className="space-y-1 text-sm text-content-secondary">
          {gaps.slice(0, GAPS_SHOWN).map((gap) => (
            <li key={gap.id} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-status-warning" />
              <span className="min-w-0">
                <span className="font-medium text-content-primary">{localized(gap.label, i18n.language)}</span>
                {gap.note && <span className="text-content-tertiary"> — {localized(gap.note, i18n.language)}</span>}
              </span>
            </li>
          ))}
          {gaps.length > GAPS_SHOWN && (
            <li className="pl-3 text-xs text-content-tertiary">{t("gapsMore", { count: gaps.length - GAPS_SHOWN })}</li>
          )}
        </ul>
      )}
      {view.tentacleTooOld && view.minTentacle && (
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-status-warning-fg">
          <TriangleAlert size={14} aria-hidden="true" className="mt-px flex-shrink-0" />
          {t("tentacleTooOld", { version: view.minTentacle })}
        </p>
      )}
    </>
  );
}

export function InstalledColumn({ report }: { report: JellyfinCompatReport }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const installed = report.installed;
  if (!installed) {
    const failure = report.installedError ?? "unreachable";
    return (
      <Column label={t("compatInstalled")}>
        <p className="flex items-start gap-1.5 text-sm text-status-error-fg">
          <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          {t(INSTALLED_FAILURE_KEY[failure])}
        </p>
      </Column>
    );
  }
  const probes = installed.probes === "ok" ? probeSummary(installed) : null;
  return (
    <Column label={t("compatInstalled")}>
      <Verdict view={installed} />
      {installed.probes === "unavailable" ? (
        <p className="text-xs text-content-tertiary">{t("probesUnavailable")}</p>
      ) : probes ? (
        <div className="space-y-1 text-xs leading-relaxed">
          <p className="flex items-start gap-1.5 text-content-secondary">
            <ShieldCheck size={14} aria-hidden="true" className={`mt-px flex-shrink-0 ${probes.missing.length ? "text-status-warning-fg" : "text-status-success-fg"}`} />
            {t("probesSummary", { count: probes.checked, present: probes.present, checked: probes.checked })}
          </p>
          {probes.missing.length > 0 && (
            <p className="pl-5 text-status-warning-fg">
              {t("probesMissing", { labels: probes.missing.map((f) => localized(f.label, i18n.language)).join(", ") })}
            </p>
          )}
        </div>
      ) : null}
    </Column>
  );
}

export function LatestColumn({ report }: { report: JellyfinCompatReport }) {
  const { t, i18n } = useTranslation("adminJellyfin");
  const latest = report.latest;
  if (!latest) {
    return (
      <Column label={t("compatLatest")}>
        <p className="text-sm text-content-tertiary">{t(report.latestError === "rate-limited" ? "latestRateLimited" : "latestUnknown")}</p>
      </Column>
    );
  }
  const situation = latestSituation(report);
  const badge = situation === "update"
    ? <StatusPill tone="brand" size="sm" dot={false}>{t("updateAvailable")}</StatusPill>
    : null;
  return (
    <Column label={t("compatLatest")}>
      {situation === "current" ? (
        <>
          <p className="text-lg font-semibold text-content-primary">{t("compatVersion", { version: latest.version })}</p>
          <p className="flex items-center gap-1.5 text-sm text-status-success-fg">
            <ShieldCheck size={16} aria-hidden="true" />
            {t("upToDate")}
          </p>
        </>
      ) : (
        <Verdict view={latest} badge={badge} />
      )}
      {situation === "ahead" && <p className="text-xs text-content-tertiary">{t("aheadOfLatest")}</p>}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-tertiary">
        {latest.publishedAt && <span>{t("publishedOn", { date: formatDay(latest.publishedAt, i18n.language) })}</span>}
        <a
          href={latest.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-content-secondary underline-offset-4 hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("releaseNotes")}
          <ExternalLink size={12} aria-hidden="true" />
          <span className="sr-only"> {t("opensNewTab")}</span>
        </a>
      </p>
    </Column>
  );
}
