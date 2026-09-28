/**
 * Ce que la machine porte, sous la bannière de l'accueil local : combien de
 * titres, la place qu'ils prennent — une jauge au dégradé de marque sur
 * l'espace du disque —, le dernier arrivé, et les deux gestes qui s'y
 * rattachent : gérer les téléchargements, et repasser en ligne quand on est
 * hors ligne À LA MAIN alors que le serveur répond.
 *
 * Carte opaque de l'écran des téléchargements : aucun `backdrop-filter` (rien
 * de vivant derrière), halos statiques dans un calque rogné, jauge en
 * `scaleX` — jamais une largeur animée.
 */

import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";
import type { DownloadListEntry } from "@tentacle-tv/offline-core";
import { setManualOffline } from "../offline/connectivityStore";
import { useConnectivity } from "../offline/useConnectivity";
import { formatBytes } from "./presets";
import { useDiskInfo } from "./useDownloadState";

export function OfflineDeviceSummary({ complete }: { complete: readonly DownloadListEntry[] }) {
  const { t } = useTranslation("downloads");
  const { usedBytes, freeBytes } = useDiskInfo();
  const { state, reachable } = useConnectivity();
  const backOnline = state === "offline-manual" && reachable === true;

  const last = complete.reduce<DownloadListEntry | null>(
    (best, entry) => (best === null || entry.createdAt > best.createdAt ? entry : best),
    null,
  );
  const lastName = last === null ? null : last.kind === "episode" ? last.seriesName ?? last.title : last.title;
  const parts = [
    t("deviceTitles", { count: complete.length }),
    usedBytes === null ? null : t("deviceSpace", { size: formatBytes(usedBytes) }),
    lastName ? t("deviceLastAdded", { name: lastName }) : null,
  ].filter((part): part is string => part !== null && part !== "");
  const total = (usedBytes ?? 0) + (freeBytes ?? 0);
  const ratio = usedBytes !== null && total > 0 ? Math.min(1, usedBytes / total) : null;

  return (
    <div className="row-gutter">
      <div className="relative flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line-subtle bg-surface-1 p-4 md:px-5">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div
            className="absolute -left-20 -top-24 h-56 w-56 rounded-full opacity-60"
            style={{ background: "radial-gradient(closest-side, rgba(var(--brand-rgb), 0.18), transparent)" }}
          />
        </div>

        <div className="relative flex min-w-0 flex-1 items-center gap-3.5">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(var(--brand-rgb),0.35)] bg-[rgba(var(--brand-rgb),0.14)] text-[var(--brand-light)]"
          >
            <HardDrive className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-content-primary">{t("heroLabel")}</p>
            <p className="truncate text-xs text-content-tertiary">{parts.join(" · ")}</p>
            {ratio !== null && (
              <div
                className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-fill-soft"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(ratio * 100)}
                aria-label={t("spaceTitle")}
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
                  style={{ transform: `scaleX(${Math.max(ratio, 0.01)})` }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {backOnline && (
            <button
              type="button"
              onClick={() => setManualOffline(false)}
              className="rounded-full bg-cta-primary-bg px-4 py-2 text-xs font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              {t("offlineGoOnline")}
            </button>
          )}
          <Link
            to="/downloads"
            className="rounded-full bg-fill-subtle px-4 py-2 text-xs font-semibold text-content-secondary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
          >
            {t("offlineManage")}
          </Link>
        </div>
      </div>
    </div>
  );
}
