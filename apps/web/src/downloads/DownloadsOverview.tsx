/**
 * L'en-tête de l'écran des téléchargements : ce que la machine porte, en un
 * coup d'œil.
 *
 * Il remplace la jauge nue « occupé / libre » et la ligne « N transferts en
 * cours » : les compteurs par état (prêts, en cours, en pause, en échec),
 * l'espace en deux segments, l'avancement GLOBAL de la file — en direct, sur
 * le magasin de progression —, les gestes sur toute la file, et la bascule du
 * mode hors ligne.
 *
 * Aucun `backdrop-filter` : la carte est opaque (surface-1), un flou derrière
 * ne se verrait pas et coûterait une passe de composition. Le halo violet →
 * rose est un dégradé statique, jamais animé.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, PauseCircle, type LucideIcon } from "lucide-react";
import { useOfflineOverview } from "@tentacle-tv/offline-core/react";
import type { DownloadEntry } from "./api";
import { DownloadsQueueActions } from "./DownloadsQueueActions";
import { OfflineModeToggle } from "./OfflineModeToggle";
import { formatBytes } from "./presets";
import { useDiskInfo } from "./useDownloadState";

export function DownloadsOverview({ entries }: { entries: readonly DownloadEntry[] }) {
  const { t } = useTranslation("downloads");
  const overview = useOfflineOverview(entries);
  const { freeBytes, usedBytes } = useDiskInfo();

  const used = usedBytes ?? overview.readyBytes;
  const total = used + (freeBytes ?? 0);
  const usedRatio = total > 0 ? Math.min(1, used / total) : 0;
  const inFlight = overview.running + overview.paused + overview.errors;
  const ratio = overview.transferRatio;

  return (
    <section className="relative rounded-2xl border border-line-subtle bg-surface-1 p-4 sm:p-5">
      {/*
        Les halos débordent de la carte : ils vivent dans un calque rogné. Posés
        directement dans la section, leur débord à droite l'agrandissait, et le
        focus d'un bouton la faisait défiler de côté en fenêtre étroite.
      */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div
          className="absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(var(--brand-accent-rgb), 0.18), transparent)" }}
        />
        <div
          className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-60"
          style={{ background: "radial-gradient(closest-side, rgba(var(--brand-rgb), 0.2), transparent)" }}
        />
      </div>

      {entries.length > 0 && (
        <div className="relative mb-4 flex flex-wrap items-center gap-2">
          {overview.ready > 0 && <Stat icon={CheckCircle2} tone="success" label={t("overviewReady", { count: overview.ready })} />}
          {overview.running > 0 && <Stat icon={Loader2} tone="info" label={t("overviewRunning", { count: overview.running })} />}
          {overview.paused > 0 && <Stat icon={PauseCircle} tone="warning" label={t("overviewPaused", { count: overview.paused })} />}
          {overview.errors > 0 && <Stat icon={AlertTriangle} tone="error" label={t("overviewErrors", { count: overview.errors })} />}
          {overview.ready > 0 && (
            <Link
              to="/on-device"
              className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-[var(--brand-light)] transition-colors duration-150 hover:bg-fill-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              {t("openOfflineCatalog")} →
            </Link>
          )}
        </div>
      )}

      <div className="relative">
        <div
          className="flex h-2 overflow-hidden rounded-full bg-fill-soft"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usedRatio * 100)}
          aria-label={t("spaceTitle")}
        >
          <div
            className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] transition-transform duration-300 motion-reduce:transition-none"
            // Un trait minimal reste visible dès le premier octet.
            style={{ transform: `scaleX(${used > 0 ? Math.max(usedRatio, 0.01) : 0})` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-content-tertiary">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]" aria-hidden />
            {t("legendTitles")} · <span className="tabular-nums text-content-secondary">{formatBytes(used)}</span>
          </span>
          {freeBytes !== null && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-fill-strong" aria-hidden />
              {t("legendFree")} · <span className="tabular-nums text-content-secondary">{formatBytes(freeBytes)}</span>
            </span>
          )}
        </div>
      </div>

      {inFlight > 0 && (
        <div className="relative mt-4 rounded-xl bg-fill-faint p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-content-secondary">{t("overviewProgressLabel")}</p>
            <DownloadsQueueActions entries={entries} />
          </div>
          {ratio !== null && (
            <>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-soft"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ratio * 100)}
                aria-label={t("overviewProgressLabel")}
              >
                <div
                  className="h-full w-full origin-left bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] transition-transform duration-300 motion-reduce:transition-none"
                  style={{ transform: `scaleX(${ratio})` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] tabular-nums text-content-quaternary">
                {t("overviewProgress", {
                  percent: Math.floor(ratio * 100),
                  done: formatBytes(overview.transferDone),
                  total: formatBytes(overview.transferTotal),
                })}
              </p>
            </>
          )}
        </div>
      )}

      <div className="relative mt-4">
        <OfflineModeToggle />
      </div>
    </section>
  );
}

const TONES = {
  success: "bg-status-success-bg text-status-success-fg",
  info: "bg-status-info-bg text-status-info-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
} as const;

function Stat({ icon: Icon, tone, label }: { icon: LucideIcon; tone: keyof typeof TONES; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[tone]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
