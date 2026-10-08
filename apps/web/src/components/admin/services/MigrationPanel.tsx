import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminNotice } from "../kit";
import { useDatabaseMigration, useRemigrate, type DatabaseMigrationSummary } from "./databaseMigrationApi";

/**
 * La migration MariaDB → SQLite sur la carte « Base de données » (serveur 1.25) :
 * d'où vient la base, la copie du cache en cours — jamais une erreur —, les
 * tables recopiées par précaution, et « Migrer à nouveau » quand l'ancienne base
 * a changé depuis ou n'a jamais été migrée. Le redémarrage est dit AVANT le
 * geste, avec l'avertissement du redémarrage des extensions. Rien face à un
 * serveur qui ne déclare pas `server.databaseMigration`.
 */
export const MigrationPanel = memo(function MigrationPanel() {
  const { data } = useDatabaseMigration();
  if (!data || (data.legacy === "none" && !data.report)) return null;
  return <Panel summary={data} />;
});

function Panel({ summary }: { summary: DatabaseMigrationSummary }) {
  const { t, i18n } = useTranslation(["adminDatabaseMigration", "adminPlugins"]);
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const report = summary.report;
  const changed = summary.sourceCheck?.status === "changed";
  const offerRemigrate = summary.sourceConfigured && (changed || summary.legacy === "never_migrated");
  const lists = report
    ? ([
        ["unrecognized", report.unrecognized],
        ["retired", report.retired],
        ["refused", report.refused.map((r) => r.table)],
      ] as const).filter(([, names]) => names.length > 0)
    : [];

  return (
    <div className="space-y-3 border-t border-line-subtle pt-4">
      {report?.sourceEmpty ? <p className="text-sm text-content-secondary">{t("sourceEmpty")}</p> : null}
      {report && !report.sourceEmpty ? (
        <div className="text-sm text-content-secondary">
          <p className="font-medium text-content-primary">
            {t("doneOn", { date: new Date(report.finishedAt).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" }) })}
          </p>
          <p>{t("doneFacts", { tables: report.tables, rows: report.rows.toLocaleString(locale), duration: duration(report.durationMs) })}</p>
          <p className="mt-1 font-mono text-xs text-content-tertiary">
            {t("sourceLabel")} : {report.sourceVersion} — {report.source.host}:{report.source.port}/{report.source.database}
          </p>
        </div>
      ) : null}
      {summary.cache.phase === "running" ? (
        <AdminNotice tone="info" title={t("cacheRunning", { percent: summary.cache.percent })}>{t("cacheRunningHint")}</AdminNotice>
      ) : null}
      {lists.map(([key, names]) => (
        <p key={key} className="text-xs leading-relaxed text-content-tertiary">{t(key, { names: names.join(", ") })}</p>
      ))}
      {offerRemigrate ? <RemigrateBlock /> : null}
    </div>
  );
}

function RemigrateBlock() {
  const { t } = useTranslation(["adminDatabaseMigration", "adminPlugins"]);
  const remigrate = useRemigrate();
  const [asked, setAsked] = useState(false);
  if (remigrate.isSuccess) return <AdminNotice tone="info">{t("adminPlugins:restarting")} {t("adminPlugins:restartingBody")}</AdminNotice>;
  return (
    <AdminNotice tone="warning" title={t("remigrateTitle")}>
      <p>{t("remigrateBody")}</p>
      {asked ? (
        <div className="mt-2 space-y-2">
          <p>{t("remigrateConfirm")} {t("adminPlugins:restartConfirmBody")}</p>
          <button
            type="button"
            disabled={remigrate.isPending}
            onClick={() => remigrate.mutate()}
            className="inline-flex h-9 items-center rounded-full bg-[var(--brand-soft)] px-4 text-sm font-semibold text-[var(--brand-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
          >
            {remigrate.isPending ? t("adminPlugins:restartRequesting") : t("adminPlugins:restartNow")}
          </button>
          {remigrate.isError ? <p className="text-status-error-fg">{t("remigrateFailed")}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAsked(true)}
          className="mt-2 inline-flex h-9 items-center rounded-full border border-line-subtle px-4 text-sm font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {t("remigrateButton")}
        </button>
      )}
    </AdminNotice>
  );
}

function duration(ms: number): string {
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms / 60_000)} min`;
}
