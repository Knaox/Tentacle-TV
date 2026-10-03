import { useTranslation } from "react-i18next";
import { CircleCheck, ExternalLink, Hourglass, RefreshCw, Server, TriangleAlert } from "lucide-react";
import {
  buildUpdateCommands,
  resolveServerUpdate,
  uiLanguage,
  type ServerUpdateReport,
  type ServerUpdateStatus,
} from "@tentacle-tv/shared";
import { MIN_SERVER_VERSION } from "../../../hooks/useServerCompat";
import { cls } from "../../../pages/adminUtils";
import { formatDay, formatMoment } from "../jellyfin/compatPresentation";
import { AdminNotice, AdminSection, StatusPill, type StatusTone } from "../kit";
import { isOutdatedUpdateServer, useServerUpdateRefresh } from "./serverUpdateApi";
import { UpdateCommand } from "./UpdateCommand";
import { useWatchedServerUpdate, type WatchOutcome } from "./useRestartWatch";

/**
 * La carte « Serveur Tentacle », TOUJOURS visible : c'est un état, pas un
 * avertissement — la version en service, la dernière publiée, l'essentiel de
 * ses nouveautés, et « conseillée » ou « obligatoire » quand un client connu
 * exige plus (`resolveServerUpdate`, shared : le minServer publié, et celui
 * de CE client — le bureau, mis à jour à part, peut exiger plus).
 *
 * La mise à jour ne passe PAS par ici : aucun accès à Docker (décision du
 * 2026-10-03). La carte donne la commande à copier, puis constate d'elle-même
 * le serveur revenu (`useWatchedServerUpdate`).
 */

export const SERVER_UPDATE_ANCHOR = "server-update";

const TONE: Record<ServerUpdateStatus, StatusTone> = {
  "up-to-date": "success",
  advised: "brand",
  mandatory: "error",
  ahead: "neutral",
  unknown: "neutral",
};

const ICON_TONE: Record<StatusTone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  brand: "bg-[var(--brand-soft)] text-[var(--brand-light)]",
  error: "bg-status-error-bg text-status-error-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  info: "bg-status-info-bg text-status-info-fg",
  neutral: "bg-fill-soft text-content-tertiary",
};

export function ServerUpdateCard({ className }: { className?: string }) {
  const { t } = useTranslation("adminOverview");
  const { query, outcome, start } = useWatchedServerUpdate();
  const refresh = useServerUpdateRefresh();
  const report = query.data;
  const busy = refresh.isPending || (query.isFetching && !query.isPending);

  return (
    <AdminSection
      id={SERVER_UPDATE_ANCHOR}
      title={t("serverTitle")}
      className={className}
      actions={
        report ? (
          <button type="button" onClick={() => refresh.mutate()} disabled={busy} className={cls.bs}>
            <RefreshCw size={16} aria-hidden="true" className={busy ? "motion-safe:animate-spin" : ""} />
            {busy ? t("serverRechecking") : t("serverRecheck")}
          </button>
        ) : undefined
      }
    >
      {report ? (
        <ReportBody report={report} outcome={outcome} onCopied={start} />
      ) : query.isError ? (
        isOutdatedUpdateServer(query.error) ? (
          <AdminNotice>{t("serverOutdated")}</AdminNotice>
        ) : (
          <AdminNotice
            tone="error"
            action={
              <button type="button" onClick={() => void query.refetch()} className="text-sm font-semibold text-content-primary underline underline-offset-4">
                {t("serverRetry")}
              </button>
            }
          >
            {t("serverLoadError")}
          </AdminNotice>
        )
      ) : (
        <div aria-hidden="true" className="space-y-3">
          <div className="skeleton-shimmer h-10 w-2/3 rounded-xl" />
          <div className="skeleton-shimmer h-4 w-1/2 rounded-full" />
        </div>
      )}
    </AdminSection>
  );
}

function ReportBody({ report, outcome, onCopied }: { report: ServerUpdateReport; outcome: WatchOutcome | null; onCopied: () => void }) {
  const { t, i18n } = useTranslation("adminOverview");
  const latest = report.latest;
  const verdict = resolveServerUpdate({
    current: report.current,
    latest: latest?.version ?? null,
    requiredByClients: report.requiredByClients,
    clientMinimum: MIN_SERVER_VERSION,
  });
  const status = verdict.status;
  const offerUpdate = status === "advised" || status === "mandatory";
  const target = latest?.version ?? verdict.required;
  const commands = offerUpdate ? buildUpdateCommands(report.install, target) : null;
  const language = uiLanguage(i18n.language);
  const highlights = latest ? (latest.highlights[language].length > 0 ? latest.highlights[language] : latest.highlights[language === "fr" ? "en" : "fr"]) : [];

  const sentence = (() => {
    switch (status) {
      case "up-to-date":
        return t("serverUpToDate");
      case "mandatory":
        return t("serverMandatory", { required: verdict.required });
      case "ahead":
        return t("serverAhead");
      default:
        return latest ? latestLine() : null;
    }
  })();

  function latestLine(): string {
    if (!latest) return "";
    const line = latest.publishedAt
      ? t("serverLatest", { version: latest.version, date: formatDay(latest.publishedAt, i18n.language) })
      : t("serverLatestNoDate", { version: latest.version });
    return report.behind > 1 ? `${line} ${t("serverBehind", { count: report.behind })}.` : line;
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${ICON_TONE[TONE[status]]}`}>
          <Server size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-lg font-semibold tabular-nums text-content-primary">{t("serverVersion", { version: report.current })}</p>
            <StatusPill tone={TONE[status]}>{t(`serverState_${status}`)}</StatusPill>
          </div>
          {sentence ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-content-secondary">{sentence}</p> : null}
          {status === "mandatory" && latest ? <p className="mt-0.5 text-sm text-content-tertiary">{latestLine()}</p> : null}
        </div>
      </div>

      {outcome ? <OutcomeLine outcome={outcome} /> : null}

      {offerUpdate && highlights.length > 0 && latest ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-content-primary">{t("serverWhatsNew", { version: latest.version })}</h3>
          <ul className="mt-2 max-w-3xl space-y-1.5">
            {highlights.map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-relaxed text-content-secondary">
                <span aria-hidden="true" className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-[var(--brand-light)]" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {latest.url ? (
            <a
              href={latest.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg text-sm font-medium text-content-secondary underline-offset-4 hover:text-content-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              {t("serverNotes")}
              <ExternalLink size={14} aria-hidden="true" />
              <span className="sr-only"> {t("opensNewTab")}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      {offerUpdate ? (
        commands ? (
          <UpdateCommand commands={commands} current={report.current} target={target} onCopied={onCopied} />
        ) : (
          <p className="mt-4 border-t border-line-subtle pt-4 text-sm leading-relaxed text-content-tertiary">{t("updateNoContainer")}</p>
        )
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-content-quaternary">
        {report.checkedAt ? t("serverCheckedAt", { date: formatMoment(report.checkedAt, i18n.language) }) : null}
        {report.error ? <span className="block text-content-tertiary">{t(`serverCheckError_${report.error}`)}</span> : null}
      </p>
    </div>
  );
}

function OutcomeLine({ outcome }: { outcome: WatchOutcome }) {
  const { t } = useTranslation("adminOverview");
  const [Icon, tone, text] =
    outcome.kind === "updated"
      ? [CircleCheck, "text-status-success-fg", t("watchUpdated", { version: outcome.version })]
      : outcome.kind === "same"
        ? [TriangleAlert, "text-status-warning-fg", t("watchSameVersion", { version: outcome.version })]
        : [Hourglass, "text-content-secondary", t("watchWaiting")];
  return (
    <p role="status" className={`mt-3 flex items-start gap-2 text-sm leading-relaxed ${tone}`}>
      {/* Une icône fixe, pas un anneau qui tourne : le guet peut durer un quart d'heure. */}
      <Icon size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
      <span>{text}</span>
    </p>
  );
}
